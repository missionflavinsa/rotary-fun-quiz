import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for direct database access
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// API key for n8n (optional - add to .env for security)
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY || ''

interface QuestionPayload {
    content: string
    type: 'mcq' | 'integer' | 'subjective'
    options?: string[]
    correct_answer: string
    difficulty?: 'easy' | 'medium' | 'hard'  // easy=NCERT, medium=Foundation, hard=Advance
    points?: number
    solution_text?: string
    class_name?: string
    class_section?: string
    subject_name?: string
    topic_name?: string
    subtopic_name?: string
    subtopic_id?: string  // Direct subtopic_id if known
    class_id?: string     // Direct class_id if known
}

interface BulkPayload {
    questions: QuestionPayload[]
    api_key?: string
}

/**
 * n8n Integration Endpoint
 * 
 * Accepts questions from external sources like n8n workflows.
 * 
 * Example n8n workflow:
 * 1. HTTP Request to ChatGPT/Claude
 * 2. Parse JSON response
 * 3. HTTP POST to this endpoint with formatted questions
 * 
 * Request format:
 * POST /api/n8n/questions
 * {
 *   "api_key": "your-optional-api-key",
 *   "questions": [
 *     {
 *       "content": "Question text",
 *       "type": "mcq",
 *       "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
 *       "correct_answer": "A) Option 1",
 *       "difficulty": "medium",
 *       "class_name": "10",
 *       "class_section": "A",
 *       "subject_name": "Mathematics",
 *       "topic_name": "Algebra",
 *       "subtopic_name": "Linear Equations"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body: BulkPayload = await request.json()

        // Optional API key verification
        if (N8N_API_KEY && body.api_key !== N8N_API_KEY) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
        }

        if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
        }

        const results = {
            success: 0,
            failed: 0,
            inserted_ids: [] as string[],
            errors: [] as string[]
        }

        // Cache for lookups
        const classCache = new Map<string, string>()
        const subjectCache = new Map<string, string>()
        const topicCache = new Map<string, string>()
        const subtopicCache = new Map<string, string>()

        for (let i = 0; i < body.questions.length; i++) {
            const q = body.questions[i]

            try {
                // Validate required fields
                if (!q.content || !q.type || !q.correct_answer) {
                    results.failed++
                    results.errors.push(`Question ${i + 1}: Missing required fields (content, type, correct_answer)`)
                    continue
                }

                // Resolve subtopic_id if not provided directly
                let subtopicId = q.subtopic_id || null
                let classId = q.class_id || null

                // If class/subject/topic names provided, resolve IDs
                if (!subtopicId && q.class_name && q.subject_name && q.topic_name) {
                    const className = q.class_name.trim()
                    const section = q.class_section?.trim() || ''
                    const classKey = `${className}|${section}`

                    // Get or create class
                    if (!classCache.has(classKey)) {
                        let query = supabase.from('classes').select('id').ilike('name', className)
                        if (section) query = query.ilike('section', section)

                        const { data: classes } = await query.limit(1)
                        if (classes && classes.length > 0) {
                            classCache.set(classKey, classes[0].id)
                        } else {
                            // Create class
                            const { data: newClass } = await supabase
                                .from('classes')
                                .insert({ name: className, section: section || '' })
                                .select('id')
                                .single()
                            if (newClass) classCache.set(classKey, newClass.id)
                        }
                    }
                    classId = classCache.get(classKey) || null

                    if (classId) {
                        const subjectName = q.subject_name.trim()
                        const subjectKey = `${classId}|${subjectName}`

                        // Get or create subject
                        if (!subjectCache.has(subjectKey)) {
                            const { data: subjects } = await supabase
                                .from('subjects')
                                .select('id')
                                .eq('class_id', classId)
                                .ilike('name', subjectName)
                                .limit(1)

                            if (subjects && subjects.length > 0) {
                                subjectCache.set(subjectKey, subjects[0].id)
                            } else {
                                const { data: newSubject } = await supabase
                                    .from('subjects')
                                    .insert({ name: subjectName, class_id: classId })
                                    .select('id')
                                    .single()
                                if (newSubject) subjectCache.set(subjectKey, newSubject.id)
                            }
                        }
                        const subjectId = subjectCache.get(subjectKey)

                        if (subjectId) {
                            const topicName = q.topic_name.trim()
                            const topicKey = `${subjectId}|${topicName}`

                            // Get or create topic
                            if (!topicCache.has(topicKey)) {
                                const { data: topics } = await supabase
                                    .from('topics')
                                    .select('id')
                                    .eq('subject_id', subjectId)
                                    .ilike('name', topicName)
                                    .limit(1)

                                if (topics && topics.length > 0) {
                                    topicCache.set(topicKey, topics[0].id)
                                } else {
                                    const { data: newTopic } = await supabase
                                        .from('topics')
                                        .insert({ name: topicName, subject_id: subjectId })
                                        .select('id')
                                        .single()
                                    if (newTopic) topicCache.set(topicKey, newTopic.id)
                                }
                            }
                            const topicId = topicCache.get(topicKey)

                            if (topicId) {
                                const subtopicName = q.subtopic_name?.trim() || topicName
                                const subtopicKey = `${topicId}|${subtopicName}`

                                // Get or create subtopic
                                if (!subtopicCache.has(subtopicKey)) {
                                    const { data: subtopics } = await supabase
                                        .from('subtopics')
                                        .select('id')
                                        .eq('topic_id', topicId)
                                        .ilike('name', subtopicName)
                                        .limit(1)

                                    if (subtopics && subtopics.length > 0) {
                                        subtopicCache.set(subtopicKey, subtopics[0].id)
                                    } else {
                                        const { data: newSubtopic } = await supabase
                                            .from('subtopics')
                                            .insert({ name: subtopicName, topic_id: topicId })
                                            .select('id')
                                            .single()
                                        if (newSubtopic) subtopicCache.set(subtopicKey, newSubtopic.id)
                                    }
                                }
                                subtopicId = subtopicCache.get(subtopicKey) || null
                            }
                        }
                    }
                }

                // Build question data
                const questionData: Record<string, any> = {
                    content: q.content,
                    type: q.type.toLowerCase(),
                    correct_answer: q.correct_answer,
                    points: q.points || 10,
                    difficulty: q.difficulty || 'medium'
                }

                if (q.type === 'mcq' && q.options) {
                    questionData.options = q.options
                }

                if (subtopicId) {
                    questionData.subtopic_id = subtopicId
                }

                if (q.solution_text) {
                    questionData.solution_text = q.solution_text
                }

                // Insert question
                const { data: inserted, error } = await supabase
                    .from('questions')
                    .insert(questionData)
                    .select('id')
                    .single()

                if (error) {
                    results.failed++
                    results.errors.push(`Question ${i + 1}: ${error.message}`)
                } else {
                    results.success++
                    if (inserted) {
                        results.inserted_ids.push(inserted.id)

                        // Link to class if we have classId
                        if (classId) {
                            await supabase
                                .from('question_class_links')
                                .insert({ question_id: inserted.id, class_id: classId })
                        }
                    }
                }
            } catch (err) {
                results.failed++
                results.errors.push(`Question ${i + 1}: ${err}`)
            }
        }

        return NextResponse.json({
            message: `${results.success} questions added, ${results.failed} failed`,
            ...results
        })
    } catch (error) {
        console.error('n8n questions endpoint error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// GET endpoint for testing/health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'n8n Questions Integration',
        usage: 'POST questions array with content, type, correct_answer, options (for MCQ)',
        example: {
            questions: [{
                content: "What is 2 + 2?",
                type: "mcq",
                options: ["A) 3", "B) 4", "C) 5", "D) 6"],
                correct_answer: "B) 4",
                difficulty: "easy",
                class_name: "5",
                class_section: "A",
                subject_name: "Mathematics",
                topic_name: "Arithmetic"
            }]
        }
    })
}
