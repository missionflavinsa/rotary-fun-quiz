import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface StudentRow {
    full_name: string
    roll_no?: string
    class_name: string
    class_section?: string
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const text = await file.text()

        const parsed = Papa.parse<StudentRow>(text, {
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

        for (const row of parsed.data) {
            try {
                // Validate required fields
                if (!row.full_name || !row.class_name) {
                    results.failed++
                    results.errors.push(`Row missing required fields: ${row.full_name || 'Unknown'}`)
                    continue
                }

                const className = row.class_name.trim()
                const section = row.class_section?.trim() || ''
                const classKey = `${className}|${section}`

                // Find or create class (with caching)
                let classId = classCache.get(classKey)
                if (!classId) {
                    // First try to find existing class by BOTH name AND section
                    let query = supabase
                        .from('classes')
                        .select('id')
                        .ilike('name', className)

                    // Match section exactly (empty string or specific section)
                    if (section) {
                        query = query.ilike('section', section)
                    } else {
                        // If no section provided, try to find class with empty/null section
                        query = query.or('section.is.null,section.eq.')
                    }

                    const { data: existingClasses } = await query.limit(1)

                    if (existingClasses && existingClasses.length > 0) {
                        classId = existingClasses[0].id
                    } else {
                        // Create new class with both name and section
                        const insertData: { name: string; section: string } = {
                            name: className,
                            section: section || ''
                        }

                        const { data: newClass, error: classError } = await supabase
                            .from('classes')
                            .insert(insertData)
                            .select('id')
                            .single()

                        if (newClass) {
                            classId = newClass.id
                        } else if (classError) {
                            console.error('Failed to create class:', classError)
                        }
                    }

                    if (classId) classCache.set(classKey, classId)
                }

                if (!classId) {
                    results.failed++
                    results.errors.push(`Could not find/create class for: ${row.full_name}`)
                    continue
                }

                // Check for duplicate student
                const { data: existingStudents } = await supabase
                    .from('students')
                    .select('id')
                    .eq('class_id', classId)
                    .ilike('full_name', row.full_name.trim())
                    .limit(1)

                if (existingStudents && existingStudents.length > 0) {
                    results.failed++
                    results.errors.push(`Student already exists: ${row.full_name}`)
                    continue
                }

                // Insert student with minimal required fields
                const studentData: Record<string, any> = {
                    full_name: row.full_name.trim(),
                    class_id: classId
                }

                if (row.roll_no?.trim()) {
                    studentData.roll_no = row.roll_no.trim()
                }

                const { error: insertError } = await supabase
                    .from('students')
                    .insert(studentData)

                if (insertError) {
                    results.failed++
                    results.errors.push(`Failed to insert: ${row.full_name} - ${insertError.message}`)
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
        console.error('Students upload error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
