"""
AI Question Generation Backend
FastAPI server with ML-powered question generation and duplicate detection
"""

import os
import json
import uuid
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Quiz AI Backend",
    description="ML-powered question generation with duplicate detection",
    version="1.0.0"
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Pydantic Models =====

class GenerateRequest(BaseModel):
    subject: str
    topic: str
    subtopic: Optional[str] = None
    difficulty: str = "medium"  # easy, medium, hard
    question_type: str = "mcq"  # mcq, integer, subjective
    class_level: Optional[str] = None
    model: str = "gemini"  # gemini, openai, claude, deepseek, local
    class_id: Optional[str] = None
    subtopic_id: Optional[str] = None

class GeneratedQuestion(BaseModel):
    content: str
    type: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: str
    is_duplicate: bool = False
    similarity_score: float = 0.0

class GenerateResponse(BaseModel):
    success: bool
    question: Optional[GeneratedQuestion] = None
    job_id: str
    message: str
    steps_completed: List[str] = []

class ProgressResponse(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, error
    current_step: str
    steps: List[Dict[str, Any]]
    result: Optional[GeneratedQuestion] = None

# ===== In-Memory Progress Tracking =====
progress_store: Dict[str, Dict] = {}

# ===== Supabase Client =====
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

async def get_existing_questions(subject: str, topic: str, limit: int = 50) -> List[Dict]:
    """Fetch existing questions from Supabase for similarity checking"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/questions",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json"
                },
                params={"select": "id,content", "limit": str(limit)}
            )
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error fetching questions: {e}")
    return []

async def save_question_to_db(question: Dict, subtopic_id: str = None, class_id: str = None) -> Optional[str]:
    """Save generated question to Supabase"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    
    async with httpx.AsyncClient() as client:
        try:
            # Insert question
            question_data = {
                "content": question["content"],
                "type": question["type"],
                "options": question.get("options"),
                "correct_answer": question["correct_answer"],
                "difficulty": question["difficulty"],
                "points": 10,
                "subtopic_id": subtopic_id,
                "solution_text": question.get("explanation")
            }
            
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/questions",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                json=question_data
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                question_id = result[0]["id"] if result else None
                
                # Link to class if provided
                if question_id and class_id:
                    await client.post(
                        f"{SUPABASE_URL}/rest/v1/question_class_links",
                        headers={
                            "apikey": SUPABASE_KEY,
                            "Authorization": f"Bearer {SUPABASE_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={"question_id": question_id, "class_id": class_id}
                    )
                
                return question_id
        except Exception as e:
            print(f"Error saving question: {e}")
    return None

# ===== Similarity Detection =====
def compute_text_similarity(text1: str, text2: str) -> float:
    """Compute basic text similarity using Jaccard index"""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)

def check_duplicate(new_question: str, existing_questions: List[Dict], threshold: float = 0.7) -> tuple:
    """Check if question is duplicate based on text similarity"""
    max_similarity = 0.0
    for q in existing_questions:
        similarity = compute_text_similarity(new_question, q.get("content", ""))
        max_similarity = max(max_similarity, similarity)
        if similarity >= threshold:
            return True, similarity
    return False, max_similarity

# ===== LLM Integration =====
async def generate_with_gemini(prompt: str) -> Optional[str]:
    """Generate question using Gemini API"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024}
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        except Exception as e:
            print(f"Gemini error: {e}")
    return None

async def generate_with_openai(prompt: str) -> Optional[str]:
    """Generate question using OpenAI API"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            print(f"OpenAI error: {e}")
    return None

async def generate_with_local(prompt: str) -> Optional[str]:
    """Generate question using local LLM (Ollama)"""
    url = os.getenv("LOCAL_LLM_URL", "http://localhost:11434")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{url}/api/generate",
                json={"model": "llama2", "prompt": prompt, "stream": False}
            )
            if response.status_code == 200:
                return response.json().get("response", "")
        except Exception as e:
            print(f"Local LLM error: {e}")
    return None

def build_prompt(req: GenerateRequest, existing_samples: List[str] = []) -> str:
    """Build prompt for question generation"""
    difficulty_map = {"easy": "NCERT level (basic)", "medium": "Foundation level (moderate)", "hard": "Advanced level (challenging)"}
    diff_desc = difficulty_map.get(req.difficulty, "moderate difficulty")
    
    type_instructions = {
        "mcq": "Create a multiple choice question with exactly 4 options (A, B, C, D). Clearly mark the correct answer.",
        "integer": "Create a numerical answer question where the answer is a single integer.",
        "subjective": "Create a short-answer question that requires a brief explanation."
    }
    
    samples_text = ""
    if existing_samples:
        samples_text = f"\nHere are some example questions from this topic for reference:\n" + "\n".join([f"- {s}" for s in existing_samples[:3]])
    
    prompt = f"""Generate a {diff_desc} question for:
Subject: {req.subject}
Topic: {req.topic}
{f"Subtopic: {req.subtopic}" if req.subtopic else ""}
{f"Class Level: {req.class_level}" if req.class_level else ""}

{type_instructions.get(req.question_type, type_instructions["mcq"])}
{samples_text}

Return your response in this exact JSON format:
{{
    "question": "The question text",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],  // only for MCQ
    "answer": "The correct answer",
    "explanation": "Brief explanation of the answer"
}}

Make sure the question is original, educational, and matches the specified difficulty level."""
    
    return prompt

def parse_llm_response(text: str, question_type: str) -> Optional[Dict]:
    """Parse LLM response to extract question data"""
    try:
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            data = json.loads(json_match.group())
            
            result = {
                "content": data.get("question", ""),
                "type": question_type,
                "correct_answer": data.get("answer", ""),
                "explanation": data.get("explanation", ""),
            }
            
            if question_type == "mcq" and "options" in data:
                result["options"] = data["options"]
            
            return result
    except Exception as e:
        print(f"Parse error: {e}")
    return None

# ===== Main Generation Endpoint =====

@app.post("/generate", response_model=GenerateResponse)
async def generate_question(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Generate a new question with duplicate checking and optional auto-save"""
    job_id = str(uuid.uuid4())
    
    # Initialize progress
    progress_store[job_id] = {
        "status": "processing",
        "current_step": "Checking existing questions...",
        "steps": [
            {"name": "fetch_existing", "status": "in_progress", "message": "Checking existing questions..."},
            {"name": "analyze_patterns", "status": "pending", "message": "Analyzing difficulty patterns..."},
            {"name": "generate", "status": "pending", "message": "Generating new question..."},
            {"name": "verify", "status": "pending", "message": "Verifying uniqueness..."},
            {"name": "complete", "status": "pending", "message": "Question ready!"}
        ],
        "result": None
    }
    
    try:
        # Step 1: Fetch existing questions
        existing = await get_existing_questions(request.subject, request.topic)
        progress_store[job_id]["steps"][0]["status"] = "completed"
        progress_store[job_id]["current_step"] = "Analyzing difficulty patterns..."
        progress_store[job_id]["steps"][1]["status"] = "in_progress"
        
        await asyncio.sleep(0.3)  # Small delay for UI feedback
        
        # Step 2: Analyze patterns (get samples for context)
        existing_samples = [q["content"] for q in existing[:5]] if existing else []
        progress_store[job_id]["steps"][1]["status"] = "completed"
        progress_store[job_id]["current_step"] = "Generating new question..."
        progress_store[job_id]["steps"][2]["status"] = "in_progress"
        
        # Step 3: Generate question
        prompt = build_prompt(request, existing_samples)
        
        # Choose LLM based on model
        llm_response = None
        if request.model == "gemini":
            llm_response = await generate_with_gemini(prompt)
        elif request.model == "openai":
            llm_response = await generate_with_openai(prompt)
        elif request.model == "local":
            llm_response = await generate_with_local(prompt)
        else:
            llm_response = await generate_with_gemini(prompt)  # Default to Gemini
        
        if not llm_response:
            progress_store[job_id]["status"] = "error"
            return GenerateResponse(
                success=False,
                job_id=job_id,
                message="Failed to generate question. Check API keys.",
                steps_completed=["fetch_existing", "analyze_patterns"]
            )
        
        # Parse the response
        question_data = parse_llm_response(llm_response, request.question_type)
        if not question_data:
            progress_store[job_id]["status"] = "error"
            return GenerateResponse(
                success=False,
                job_id=job_id,
                message="Failed to parse LLM response",
                steps_completed=["fetch_existing", "analyze_patterns", "generate"]
            )
        
        progress_store[job_id]["steps"][2]["status"] = "completed"
        progress_store[job_id]["current_step"] = "Verifying uniqueness..."
        progress_store[job_id]["steps"][3]["status"] = "in_progress"
        
        # Step 4: Check for duplicates
        is_duplicate, similarity = check_duplicate(question_data["content"], existing)
        
        progress_store[job_id]["steps"][3]["status"] = "completed"
        progress_store[job_id]["current_step"] = "Question ready!"
        progress_store[job_id]["steps"][4]["status"] = "completed"
        
        # Build response
        generated_question = GeneratedQuestion(
            content=question_data["content"],
            type=question_data["type"],
            options=question_data.get("options"),
            correct_answer=question_data["correct_answer"],
            explanation=question_data.get("explanation"),
            difficulty=request.difficulty,
            is_duplicate=is_duplicate,
            similarity_score=similarity
        )
        
        progress_store[job_id]["status"] = "completed"
        progress_store[job_id]["result"] = generated_question.model_dump()
        
        # Auto-save to database if subtopic_id provided
        saved_id = None
        if request.subtopic_id and not is_duplicate:
            saved_id = await save_question_to_db(
                question_data, 
                subtopic_id=request.subtopic_id, 
                class_id=request.class_id
            )
        
        return GenerateResponse(
            success=True,
            question=generated_question,
            job_id=job_id,
            message=f"Question generated successfully{' and saved to database' if saved_id else ''}{'(possible duplicate detected)' if is_duplicate else ''}",
            steps_completed=["fetch_existing", "analyze_patterns", "generate", "verify", "complete"]
        )
        
    except Exception as e:
        progress_store[job_id]["status"] = "error"
        return GenerateResponse(
            success=False,
            job_id=job_id,
            message=f"Error: {str(e)}",
            steps_completed=[]
        )

@app.get("/progress/{job_id}", response_model=ProgressResponse)
async def get_progress(job_id: str):
    """Get progress of a generation job"""
    if job_id not in progress_store:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = progress_store[job_id]
    return ProgressResponse(
        job_id=job_id,
        status=job["status"],
        current_step=job["current_step"],
        steps=job["steps"],
        result=job.get("result")
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "Quiz AI Backend",
        "version": "1.0.0",
        "endpoints": {
            "POST /generate": "Generate a new question",
            "GET /progress/{job_id}": "Get generation progress",
            "GET /health": "Health check"
        }
    }
