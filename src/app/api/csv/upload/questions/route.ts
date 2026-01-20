import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface QuestionRow {
    content: string
    type: string
    options: string
    correct_answer: string
    points?: string
    difficulty?: string
    class_name: string
    class_section?: string
    subject_name: string
    topic_name: string
    subtopic_name?: string
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const text = await file.text()

        const parsed = Papa.parse<QuestionRow>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        })

        if (parsed.errors.length > 0) {
            return NextResponse.json({
                error: 'CSV parsing errors',
                details: parsed.errors
            }, { status: 400 })
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        }

        // Cache to avoid duplicate lookups within same CSV upload
        const classCache = new Map<string, string>()
        const subjectCache = new Map<string, string>()
        const topicCache = new Map<string, string>()
        const subtopicCache = new Map<string, string>()

        for (const row of parsed.data) {
            try {
                // Validate required fields
                if (!row.content || !row.type || !row.correct_answer || !row.class_name || !row.subject_name || !row.topic_name) {
                    results.failed++
                    results.errors.push(`Row missing required fields: ${row.content?.slice(0, 30) || 'Unknown'}`)
                    continue
                }

                const className = row.class_name.trim()
                const section = row.class_section?.trim() || ''
                const classKey = `${className}|${section}`

                // Find or create class (with caching)
                let classId = classCache.get(classKey)
                if (!classId) {
                    // First try to find existing class
                    const { data: existingClasses } = await supabase
                        .from('classes')
                        .select('id')
                        .ilike('name', className)
                        .limit(1)

                    if (existingClasses && existingClasses.length > 0) {
                        classId = existingClasses[0].id
                    } else {
                        // Create new class
                        const insertData: { name: string; section?: string } = { name: className }
                        if (section) insertData.section = section

                        const { data: newClass } = await supabase
                            .from('classes')
                            .insert(insertData)
                            .select('id')
                            .single()

                        if (newClass) classId = newClass.id
                    }

                    if (classId) classCache.set(classKey, classId)
                }

                if (!classId) {
                    results.failed++
                    results.errors.push(`Could not find/create class: ${className}`)
                    continue
                }

                // Find or create subject (with caching)
                const subjectName = row.subject_name.trim()
                const subjectKey = `${classId}|${subjectName}`

                let subjectId = subjectCache.get(subjectKey)
                if (!subjectId) {
                    const { data: existingSubjects } = await supabase
                        .from('subjects')
                        .select('id')
                        .eq('class_id', classId)
                        .ilike('name', subjectName)
                        .limit(1)

                    if (existingSubjects && existingSubjects.length > 0) {
                        subjectId = existingSubjects[0].id
                    } else {
                        const { data: newSubject } = await supabase
                            .from('subjects')
                            .insert({ name: subjectName, class_id: classId })
                            .select('id')
                            .single()

                        if (newSubject) subjectId = newSubject.id
                    }

                    if (subjectId) subjectCache.set(subjectKey, subjectId)
                }

                if (!subjectId) {
                    results.failed++
                    results.errors.push(`Could not find/create subject: ${subjectName}`)
                    continue
                }

                // Find or create topic (with caching)
                const topicName = row.topic_name.trim()
                const topicKey = `${subjectId}|${topicName}`

                let topicId = topicCache.get(topicKey)
                if (!topicId) {
                    const { data: existingTopics } = await supabase
                        .from('topics')
                        .select('id')
                        .eq('subject_id', subjectId)
                        .ilike('name', topicName)
                        .limit(1)

                    if (existingTopics && existingTopics.length > 0) {
                        topicId = existingTopics[0].id
                    } else {
                        const { data: newTopic } = await supabase
                            .from('topics')
                            .insert({ name: topicName, subject_id: subjectId })
                            .select('id')
                            .single()

                        if (newTopic) topicId = newTopic.id
                    }

                    if (topicId) topicCache.set(topicKey, topicId)
                }

                if (!topicId) {
                    results.failed++
                    results.errors.push(`Could not find/create topic: ${topicName}`)
                    continue
                }

                // Find or create subtopic (with caching)
                const subtopicName = row.subtopic_name?.trim() || topicName
                const subtopicKey = `${topicId}|${subtopicName}`

                let subtopicId = subtopicCache.get(subtopicKey)
                if (!subtopicId) {
                    const { data: existingSubtopics } = await supabase
                        .from('subtopics')
                        .select('id')
                        .eq('topic_id', topicId)
                        .ilike('name', subtopicName)
                        .limit(1)

                    if (existingSubtopics && existingSubtopics.length > 0) {
                        subtopicId = existingSubtopics[0].id
                    } else {
                        const { data: newSubtopic } = await supabase
                            .from('subtopics')
                            .insert({ name: subtopicName, topic_id: topicId })
                            .select('id')
                            .single()

                        if (newSubtopic) subtopicId = newSubtopic.id
                    }

                    if (subtopicId) subtopicCache.set(subtopicKey, subtopicId)
                }

                // Parse options for MCQ
                let options = null
                if (row.type.toLowerCase() === 'mcq' && row.options) {
                    try {
                        options = JSON.parse(row.options)
                    } catch {
                        options = row.options.split(',').map(o => o.trim())
                    }
                }

                // Build question data
                const questionData: Record<string, any> = {
                    content: row.content,
                    type: row.type.toLowerCase(),
                    options: options,
                    correct_answer: row.correct_answer,
                    points: parseInt(row.points || '10') || 10,
                    subtopic_id: subtopicId || null
                }

                if (row.difficulty) {
                    questionData.difficulty = row.difficulty.toLowerCase()
                }

                // Insert question
                let { error: insertError } = await supabase
                    .from('questions')
                    .insert(questionData)

                // Retry without difficulty if column doesn't exist
                if (insertError && insertError.message.includes('difficulty')) {
                    delete questionData.difficulty
                    const retryResult = await supabase
                        .from('questions')
                        .insert(questionData)
                    insertError = retryResult.error
                }

                if (insertError) {
                    results.failed++
                    results.errors.push(`Failed to insert: ${row.content.slice(0, 30)}... - ${insertError.message}`)
                } else {
                    results.success++
                }
            } catch (err) {
                results.failed++
                results.errors.push(`Error processing row: ${err}`)
            }
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error('Questions upload error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
