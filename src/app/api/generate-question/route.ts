import { NextRequest, NextResponse } from 'next/server'
import { generateQuestion } from '@/lib/ai/question-generator'

// Python ML Backend URL (optional - for advanced features)
const PYTHON_BACKEND_URL = process.env.PYTHON_ML_BACKEND_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            subject,
            topic,
            subtopic,
            difficulty,
            questionType,
            classLevel,
            model,
            usePythonBackend,
            subtopic_id,
            class_id
        } = body

        if (!subject || !topic) {
            return NextResponse.json(
                { error: 'Subject and topic are required' },
                { status: 400 }
            )
        }

        // Use Python ML Backend if requested
        if (usePythonBackend) {
            try {
                const pythonResponse = await fetch(`${PYTHON_BACKEND_URL}/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject,
                        topic,
                        subtopic,
                        difficulty: difficulty || 'medium',
                        question_type: questionType || 'mcq',
                        class_level: classLevel || '10',
                        model: model || 'gemini',
                        subtopic_id,
                        class_id
                    })
                })

                if (pythonResponse.ok) {
                    const data = await pythonResponse.json()
                    return NextResponse.json({
                        question: data.question,
                        job_id: data.job_id,
                        message: data.message,
                        steps_completed: data.steps_completed,
                        is_duplicate: data.question?.is_duplicate,
                        similarity_score: data.question?.similarity_score
                    })
                } else {
                    console.log('Python backend failed, falling back to direct LLM')
                }
            } catch (e) {
                console.log('Python backend not available, falling back to direct LLM:', e)
            }
        }

        // Fallback to direct LLM generation
        const question = await generateQuestion({
            subject,
            topic,
            subtopic,
            difficulty: difficulty || 'medium',
            questionType: questionType || 'mcq',
            classLevel: classLevel || '10',
            model: model || 'gemini'
        })

        if (!question) {
            return NextResponse.json(
                { error: 'Failed to generate question. Please check API keys.' },
                { status: 500 }
            )
        }

        return NextResponse.json({ question })
    } catch (error) {
        console.error('Generate question API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
