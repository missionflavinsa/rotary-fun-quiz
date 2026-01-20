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

        // Build query with optional class filter
        let query = supabase
            .from('students')
            .select(`
                full_name,
                roll_no,
                total_points,
                current_level,
                classes!inner(name, section)
            `)

        if (classId) {
            query = query.eq('class_id', classId)
        }

        const { data: students, error } = await query.order('full_name').limit(1000)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Transform data for CSV
        const csvData = students.map((s: any) => ({
            full_name: s.full_name,
            roll_no: s.roll_no || '',
            class_name: s.classes?.name || '',
            class_section: s.classes?.section || '',
            total_points: s.total_points,
            current_level: s.current_level
        }))

        const csv = Papa.unparse(csvData)

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="students_export_${Date.now()}.csv"`,
            },
        })
    } catch (error) {
        console.error('Students export error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
