import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const classId = searchParams.get('classId')
        const subjectId = searchParams.get('subjectId')
        const topicId = searchParams.get('topicId')

        // Build query with optional filters
        let query = supabase
            .from('questions')
            .select(`
                content,
                type,
                options,
                correct_answer,
                explanation,
                points,
                difficulty,
                subjects!inner(name, classes!inner(name)),
                topics(name),
                subtopics(name)
            `)

        if (subjectId) {
            query = query.eq('subject_id', subjectId)
        }
        if (topicId) {
            query = query.eq('topic_id', topicId)
        }

        const { data: questions, error } = await query.limit(1000)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Transform data for CSV
        const csvData = questions.map((q: any) => ({
            content: q.content,
            type: q.type,
            options: q.options ? JSON.stringify(q.options) : '',
            correct_answer: q.correct_answer,
            explanation: q.explanation || '',
            points: q.points,
            difficulty: q.difficulty,
            class_name: q.subjects?.classes?.name || '',
            subject_name: q.subjects?.name || '',
            topic_name: q.topics?.name || '',
            subtopic_name: q.subtopics?.name || ''
        }))

        const csv = Papa.unparse(csvData)

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="questions_export_${Date.now()}.csv"`,
            },
        })
    } catch (error) {
        console.error('Questions export error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
