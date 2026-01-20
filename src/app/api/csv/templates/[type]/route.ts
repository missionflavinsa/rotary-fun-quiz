import { NextRequest, NextResponse } from 'next/server'

// CSV Templates for bulk upload

const QUESTIONS_TEMPLATE = `content,type,options,correct_answer,explanation,points,difficulty,class_name,class_section,subject_name,topic_name,subtopic_name
"What is 2+2?",mcq,"[""2"",""3"",""4"",""5""]","4","Basic addition shows 2+2=4",10,easy,Class 10,A,Mathematics,Arithmetic,Addition
"What is H2O commonly known as?",mcq,"[""Water"",""Oxygen"",""Hydrogen"",""Salt""]","Water","H2O is the chemical formula for water",10,medium,Class 10,A,Chemistry,Matter,Molecules
"Calculate 15 × 4",integer,"","60","Simple multiplication",10,easy,Class 10,B,Mathematics,Arithmetic,Multiplication
"Who wrote Romeo and Juliet?",mcq,"[""Shakespeare"",""Dickens"",""Austen"",""Hemingway""]","Shakespeare","William Shakespeare wrote this famous tragedy",10,medium,Class 10,B,English,Literature,Drama`

const STUDENTS_TEMPLATE = `full_name,roll_no,class_name,class_section
Rahul Sharma,001,Class 10,A
Priya Patel,002,Class 10,A
Amit Kumar,003,Class 10,B
Sneha Gupta,004,Class 10,B
Vikram Singh,005,Class 10,A`

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    const { type } = await params

    let csvContent: string
    let filename: string

    switch (type) {
        case 'questions':
            csvContent = QUESTIONS_TEMPLATE
            filename = 'questions_template.csv'
            break
        case 'students':
            csvContent = STUDENTS_TEMPLATE
            filename = 'students_template.csv'
            break
        default:
            return NextResponse.json({ error: 'Invalid template type' }, { status: 400 })
    }

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
