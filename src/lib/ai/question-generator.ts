// AI Question Generator
// Supports: Gemini, OpenAI, Claude, DeepSeek, Grok

export interface GeneratedQuestion {
    content: string
    type: 'mcq' | 'integer' | 'subjective'
    options?: string[]
    correct_answer: string
    explanation?: string
    difficulty: 'easy' | 'medium' | 'hard'
}

export interface GenerateParams {
    subject: string
    topic: string
    subtopic?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    questionType?: 'mcq' | 'integer' | 'subjective'
    classLevel?: string
    model?: 'gemini' | 'openai' | 'claude' | 'deepseek' | 'grok' | 'local'
}

// ==================== GEMINI ====================
export async function generateQuestionWithGemini(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        console.error('GEMINI_API_KEY not configured')
        return null
    }

    const prompt = buildPrompt(params)

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            }
        )

        const data = await response.json()
        if (!response.ok) {
            console.error('Gemini API Error:', response.status, data)
            return null
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) {
            console.error('Gemini returned empty response:', data)
            return null
        }

        return parseAIResponse(text, params.questionType || 'mcq')
    } catch (error) {
        console.error('Gemini API Error:', error)
        return null
    }
}

// ==================== OPENAI ====================
export async function generateQuestionWithOpenAI(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        console.error('OPENAI_API_KEY not configured')
        return null
    }

    const prompt = buildPrompt(params)

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are an educational question generator for Indian school exams. Generate questions in JSON format.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        })

        const data = await response.json()
        if (!response.ok) {
            console.error('OpenAI API Error:', response.status, data)
            return null
        }

        const text = data.choices?.[0]?.message?.content
        if (!text) {
            console.error('OpenAI returned empty response:', data)
            return null
        }

        return parseAIResponse(text, params.questionType || 'mcq')
    } catch (error) {
        console.error('OpenAI API Error:', error)
        return null
    }
}

// ==================== CLAUDE ====================
export async function generateQuestionWithClaude(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.error('CLAUDE_API_KEY or ANTHROPIC_API_KEY not configured')
        return null
    }

    const prompt = buildPrompt(params)

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            })
        })

        const data = await response.json()
        if (!response.ok) {
            console.error('Claude API Error:', response.status, data)
            return null
        }

        const text = data.content?.[0]?.text
        if (!text) {
            console.error('Claude returned empty response:', data)
            return null
        }

        return parseAIResponse(text, params.questionType || 'mcq')
    } catch (error) {
        console.error('Claude API Error:', error)
        return null
    }
}

// ==================== DEEPSEEK ====================
export async function generateQuestionWithDeepSeek(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
        console.error('DEEPSEEK_API_KEY not configured')
        return null
    }

    const prompt = buildPrompt(params)

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are an educational question generator for Indian school exams. Generate questions in JSON format.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        })

        const data = await response.json()
        if (!response.ok) {
            console.error('DeepSeek API Error:', response.status, data)
            return null
        }

        const text = data.choices?.[0]?.message?.content
        if (!text) {
            console.error('DeepSeek returned empty response:', data)
            return null
        }

        return parseAIResponse(text, params.questionType || 'mcq')
    } catch (error) {
        console.error('DeepSeek API Error:', error)
        return null
    }
}

// ==================== GROK ====================
export async function generateQuestionWithGrok(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY
    if (!apiKey) {
        console.error('GROK_API_KEY or XAI_API_KEY not configured')
        return null
    }

    const prompt = buildPrompt(params)

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-beta',
                messages: [
                    { role: 'system', content: 'You are an educational question generator for Indian school exams. Generate questions in JSON format.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        })

        const data = await response.json()
        if (!response.ok) {
            console.error('Grok API Error:', response.status, data)
            return null
        }

        const text = data.choices?.[0]?.message?.content
        if (!text) {
            console.error('Grok returned empty response:', data)
            return null
        }

        return parseAIResponse(text, params.questionType || 'mcq')
    } catch (error) {
        console.error('Grok API Error:', error)
        return null
    }
}

// ==================== LOCAL LLM ====================
export async function generateQuestionWithLocalLLM(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const apiUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434/v1/chat/completions'
    const model = process.env.LOCAL_LLM_MODEL || 'llama3'

    const prompt = buildPrompt(params)

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are an educational question generator for Indian school exams. Generate questions in JSON format. Return VALID JSON only.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            })
        })

        const data = await response.json()
        if (!response.ok) {
            console.error('Local LLM API Error:', response.status, data)
            return null
        }

        const text = data.choices?.[0]?.message?.content
        if (!text) {
            console.error('Local LLM returned empty response:', data)
            return null
        }

        return parseAIResponse(text, params.questionType || 'mcq')
    } catch (error) {
        console.error('Local LLM API Error:', error)
        return null
    }
}

// ==================== PROMPT BUILDER ====================
function buildPrompt(params: GenerateParams): string {
    const { subject, topic, subtopic, difficulty = 'medium', questionType = 'mcq', classLevel = '10' } = params

    return `
Generate a ${difficulty} difficulty ${questionType.toUpperCase()} question for Class ${classLevel} students on:
- Subject: ${subject}
- Topic: ${topic}
${subtopic ? `- Subtopic: ${subtopic}` : ''}

Requirements:
1. Questions should be suitable for Indian school education (CBSE/ICSE pattern)
2. For MCQ: provide exactly 4 options with only one correct answer
3. Include a brief explanation for the answer

Return the response in this exact JSON format:
{
  "content": "The question text here",
  "type": "${questionType}",
  ${questionType === 'mcq' ? '"options": ["Option A", "Option B", "Option C", "Option D"],' : ''}
  "correct_answer": "The correct answer",
  "explanation": "Brief explanation",
  "difficulty": "${difficulty}"
}

Only return the JSON, no additional text.
`
}

// ==================== RESPONSE PARSER ====================
function parseAIResponse(text: string, defaultType: string): GeneratedQuestion | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null

        const parsed = JSON.parse(jsonMatch[0])

        return {
            content: parsed.content || parsed.question || '',
            type: parsed.type || defaultType,
            options: parsed.options,
            correct_answer: parsed.correct_answer || parsed.answer || '',
            explanation: parsed.explanation,
            difficulty: parsed.difficulty || 'medium'
        }
    } catch (error) {
        console.error('Failed to parse AI response:', error)
        return null
    }
}

// ==================== MAIN FUNCTION ====================
export async function generateQuestion(params: GenerateParams): Promise<GeneratedQuestion | null> {
    const model = params.model || 'gemini'

    console.log(`Generating question with model: ${model}`)

    switch (model) {
        case 'gemini':
            return generateQuestionWithGemini(params)
        case 'openai':
            return generateQuestionWithOpenAI(params)
        case 'claude':
            return generateQuestionWithClaude(params)
        case 'deepseek':
            return generateQuestionWithDeepSeek(params)
        case 'grok':
            return generateQuestionWithGrok(params)
        case 'local':
            return generateQuestionWithLocalLLM(params)
        default:
            console.error(`Unknown model: ${model}, defaulting to Gemini`)
            return generateQuestionWithGemini(params)
    }
}
