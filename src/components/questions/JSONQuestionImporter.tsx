'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileJson, CheckCircle, XCircle, AlertTriangle, Loader2, Copy, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface JSONQuestionImporterProps {
    classes: { id: string; name: string; section: string }[]
    subjects: { id: string; name: string; class_id?: string }[]
    topics: { id: string; name: string; subject_id: string }[]
    subtopics: { id: string; name: string; topic_id: string }[]
    onSuccess: () => void
}

interface QuestionJSON {
    content: string
    type: 'mcq' | 'integer' | 'subjective'
    options?: string[]
    correct_answer: string
    difficulty?: 'easy' | 'medium' | 'hard'
    points?: number
    solution_text?: string
    class_names?: string[]  // e.g., ["7-A", "7-B", "8-A"]
    class_ids?: string[]    // Direct class IDs if known
    subject_name?: string
    topic_name?: string
    subtopic_name?: string
    subtopic_id?: string
}

const EXAMPLE_JSON = `[
  {
    "content": "Your question text here...",
    "type": "mcq",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correct_answer": "Option 2",
    "difficulty": "medium",
    "points": 10,
    "solution_text": "Explanation of the answer...",
    "class_names": ["Class 7 - Satyendra Nath Bose"],
    "subject_name": "Mathematics",
    "topic_name": "Algebra",
    "subtopic_name": "Linear Equations"
  },
  {
    "content": "Integer type question here...",
    "type": "integer",
    "correct_answer": "42",
    "difficulty": "easy",
    "class_names": ["Class 7 - Sunita Williams"]
  },
  {
    "content": "Subjective question here...",
    "type": "subjective",
    "correct_answer": "Expected answer text...",
    "difficulty": "hard",
    "class_names": ["Class 8 - Kalpana Chawla"]
  }
]`

export function JSONQuestionImporter({ classes, subjects, topics, subtopics, onSuccess }: JSONQuestionImporterProps) {
    const [jsonText, setJsonText] = useState('')
    const [isExpanded, setIsExpanded] = useState(false)
    const [showExample, setShowExample] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [copied, setCopied] = useState(false)
    const [result, setResult] = useState<{
        success: number
        failed: number
        errors: string[]
        stats?: { createdSubjects: number; createdTopics: number; createdSubtopics: number }
    } | null>(null)

    const supabase = createClient()

    const copyExample = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(EXAMPLE_JSON)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea')
            textArea.value = EXAMPLE_JSON
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const resolveClassIds = (classNames: string[]): string[] => {
        const ids: string[] = []
        console.log('Available classes:', classes)
        console.log('Trying to match:', classNames)

        for (const cn of classNames) {
            // Format expected: "Class 7 - Satyendra Nath Bose" or "7 - Satyendra Nath Bose" or "7-A"
            // Split by " - " first (with spaces), then by "-" (without spaces)
            let name = ''
            let section = ''

            if (cn.includes(' - ')) {
                // Format: "Class 7 - Satyendra Nath Bose"
                const parts = cn.split(' - ')
                name = parts[0].replace(/^class\s*/i, '').trim()
                section = parts.slice(1).join(' - ').trim()
            } else if (cn.includes('-')) {
                // Format: "7-A" or "Class 7-A"
                const parts = cn.split('-')
                name = parts[0].replace(/^class\s*/i, '').trim()
                section = parts.slice(1).join('-').trim()
            } else {
                // Just class name like "7" or "Class 7"
                name = cn.replace(/^class\s*/i, '').trim()
            }

            console.log(`Parsed "${cn}" as name="${name}", section="${section}"`)

            // Try to find matching class
            const found = classes.find(c => {
                // Check class name (handle "Class 7" vs "7")
                const cName = c.name.replace(/^class\s*/i, '').trim().toLowerCase()
                const inputName = name.toLowerCase()
                const nameMatch = cName === inputName ||
                    cName.includes(inputName) ||
                    inputName.includes(cName)

                if (!section) return nameMatch

                // Check section
                const cSection = c.section.toLowerCase().trim()
                const inputSection = section.toLowerCase().trim()
                const sectionMatch = cSection === inputSection ||
                    cSection.includes(inputSection) ||
                    inputSection.includes(cSection)

                return nameMatch && sectionMatch
            })

            if (found) {
                console.log(`✓ Matched "${cn}" to class:`, found.name, '-', found.section)
                ids.push(found.id)
            } else {
                console.log(`✗ No match found for "${cn}"`)
            }
        }
        return ids
    }

    // Cache for newly created items during this session to prevent duplicates
    type HierarchyCache = {
        subjects: Record<string, string> // key: "classId-name" -> id
        topics: Record<string, string>   // key: "subjectId-name" -> id
        subtopics: Record<string, string> // key: "topicId-name" -> id
    }

    type ImportStats = {
        createdSubjects: number
        createdTopics: number
        createdSubtopics: number
    }

    // Resolve or create subject/topic/subtopic hierarchy
    const resolveOrCreateSubtopic = async (
        classId: string,
        subjectName: string,
        topicName: string,
        subtopicName: string | undefined,
        cache: HierarchyCache,
        stats: ImportStats
    ): Promise<string | null> => {
        try {
            // 1. Find or create subject
            const subjectKey = `${classId}-${subjectName.toLowerCase()}`
            let subjectId = cache.subjects[subjectKey]

            if (!subjectId) {
                // Check existing state
                const existing = subjects.find(s =>
                    s.name.toLowerCase() === subjectName.toLowerCase() &&
                    s.class_id === classId
                )
                if (existing) {
                    subjectId = existing.id
                } else {
                    // Create new
                    const { data, error } = await supabase
                        .from('subjects')
                        .insert({ name: subjectName, class_id: classId })
                        .select('id')
                        .single()

                    if (error) {
                        console.error(`Failed to create subject: ${error.message}`)
                        return null
                    }
                    subjectId = data.id
                    stats.createdSubjects++
                    console.log(`✓ Created subject "${subjectName}"`)
                }
                // Add to cache
                cache.subjects[subjectKey] = subjectId
            }

            // 2. Find or create topic
            const topicKey = `${subjectId}-${topicName.toLowerCase()}`
            let topicId = cache.topics[topicKey]

            if (!topicId) {
                const existing = topics.find(t =>
                    t.subject_id === subjectId &&
                    t.name.toLowerCase() === topicName.toLowerCase()
                )
                if (existing) {
                    topicId = existing.id
                } else {
                    const { data, error } = await supabase
                        .from('topics')
                        .insert({ name: topicName, subject_id: subjectId })
                        .select('id')
                        .single()

                    if (error) {
                        console.error(`Failed to create topic: ${error.message}`)
                        return null
                    }
                    topicId = data.id
                    stats.createdTopics++
                    console.log(`✓ Created topic "${topicName}"`)
                }
                cache.topics[topicKey] = topicId
            }

            // 3. Find or create subtopic
            const finalSubtopicName = subtopicName || topicName
            const subtopicKey = `${topicId}-${finalSubtopicName.toLowerCase()}`
            let subtopicId = cache.subtopics[subtopicKey]

            if (!subtopicId) {
                const existing = subtopics.find(st =>
                    st.topic_id === topicId &&
                    st.name.toLowerCase() === finalSubtopicName.toLowerCase()
                )
                if (existing) {
                    subtopicId = existing.id
                } else {
                    const { data, error } = await supabase
                        .from('subtopics')
                        .insert({ name: finalSubtopicName, topic_id: topicId })
                        .select('id')
                        .single()

                    if (error) {
                        console.error(`Failed to create subtopic: ${error.message}`)
                        return null
                    }
                    subtopicId = data.id
                    stats.createdSubtopics++
                    console.log(`✓ Created subtopic "${finalSubtopicName}"`)
                }
                cache.subtopics[subtopicKey] = subtopicId
            }

            return subtopicId || null
        } catch (err) {
            console.error('Error in resolveOrCreateSubtopic:', err)
            return null
        }
    }

    const handleImport = async () => {
        if (!jsonText.trim()) {
            alert('Please paste JSON data first')
            return
        }

        let questions: QuestionJSON[]
        try {
            questions = JSON.parse(jsonText)
            if (!Array.isArray(questions)) {
                questions = [questions]
            }
        } catch (e) {
            alert('Invalid JSON format. Please check the syntax.')
            return
        }

        setIsImporting(true)
        setResult(null)

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[],
            stats: { createdSubjects: 0, createdTopics: 0, createdSubtopics: 0 }
        }

        // Initialize cache for this import batch
        const hierarchyCache: HierarchyCache = {
            subjects: {},
            topics: {},
            subtopics: {}
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i]

            try {
                // Validate required fields
                if (!q.content || !q.type || !q.correct_answer) {
                    results.failed++
                    results.errors.push(`Question ${i + 1}: Missing required fields`)
                    continue
                }

                // Resolve class IDs
                let classIds: string[] = q.class_ids || []
                if (classIds.length === 0 && q.class_names && q.class_names.length > 0) {
                    classIds = resolveClassIds(q.class_names)
                }

                // Resolve or create subtopic (needs classId for subject creation)
                // We ensure hierarchy exists for ALL assigned classes
                let subtopicId: string | null = q.subtopic_id || null

                if (q.subject_name && q.topic_name && classIds.length > 0) {
                    for (let j = 0; j < classIds.length; j++) {
                        const cid = classIds[j]
                        const sid = await resolveOrCreateSubtopic(
                            cid,
                            q.subject_name,
                            q.topic_name,
                            q.subtopic_name,
                            hierarchyCache,
                            results.stats
                        )

                        // Use the subtopic ID from the first class as the primary one for the question record
                        // (Since questions table only has one subtopic_id column)
                        if (j === 0 && !subtopicId) {
                            subtopicId = sid
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
                } else if (inserted) {
                    results.success++

                    // Link to classes
                    if (classIds.length > 0) {
                        const links = classIds.map(cid => ({
                            question_id: inserted.id,
                            class_id: cid
                        }))
                        await supabase.from('question_class_links').insert(links)
                    }
                }
            } catch (err) {
                results.failed++
                results.errors.push(`Question ${i + 1}: ${err}`)
            }
        }

        setResult(results)
        setIsImporting(false)

        if (results.success > 0) {
            onSuccess()
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
                <div className="flex items-center gap-3">
                    <FileJson className="w-5 h-5 text-fuchsia-600" />
                    <span className="font-medium text-gray-700">Import Questions from ChatGPT (JSON)</span>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5 border-t border-gray-100"
                    >
                        <div className="pt-4 space-y-4">
                            {/* Instructions */}
                            <div className="bg-gradient-to-r from-fuchsia-50 to-violet-50 rounded-xl p-4">
                                <h4 className="font-semibold text-gray-800 mb-2">📝 How to use:</h4>
                                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                                    <li>Copy the example JSON below and modify it for ChatGPT</li>
                                    <li>Ask ChatGPT to generate questions in this JSON format</li>
                                    <li>Copy ChatGPT's response and paste it below</li>
                                    <li>Click "Import Questions" to add them to your question bank</li>
                                </ol>
                            </div>

                            {/* Example Toggle */}
                            <div>
                                <button
                                    onClick={() => setShowExample(!showExample)}
                                    className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1"
                                >
                                    {showExample ? 'Hide' : 'Show'} Example JSON Format
                                    {showExample ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                <AnimatePresence>
                                    {showExample && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="mt-3"
                                        >
                                            <div className="relative rounded-xl overflow-hidden border border-gray-700">
                                                {/* Copy button - positioned in top right corner inside the box */}
                                                <button
                                                    onClick={copyExample}
                                                    className={`absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-lg ${copied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}
                                                >
                                                    {copied ? (
                                                        <><Check className="w-3 h-3" /> Copied!</>
                                                    ) : (
                                                        <><Copy className="w-3 h-3" /> Copy</>
                                                    )}
                                                </button>
                                                <pre className="bg-gray-900 text-green-400 p-4 pt-12 text-xs overflow-x-auto max-h-72 overflow-y-auto">
                                                    {EXAMPLE_JSON}
                                                </pre>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                <strong>Note:</strong> class_names format is &quot;Class [Number] - [Section Name]&quot; (e.g., &quot;Class 7 - Satyendra Nath Bose&quot;)
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* JSON Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Paste ChatGPT's JSON response here:
                                </label>
                                <textarea
                                    value={jsonText}
                                    onChange={(e) => setJsonText(e.target.value)}
                                    placeholder='[{"content": "Your question...", "type": "mcq", ...}]'
                                    className="w-full h-48 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-mono text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none"
                                />
                            </div>

                            {/* Import Button */}
                            <button
                                onClick={handleImport}
                                disabled={isImporting || !jsonText.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-700 hover:to-violet-700 text-white px-6 py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <FileJson className="w-5 h-5" />
                                        Import Questions
                                    </>
                                )}
                            </button>

                            {/* Results */}
                            <AnimatePresence>
                                {result && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`rounded-xl p-4 ${result.failed === 0
                                            ? 'bg-green-50 border border-green-200'
                                            : result.success === 0
                                                ? 'bg-red-50 border border-red-200'
                                                : 'bg-amber-50 border border-amber-200'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {result.failed === 0 ? (
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                            ) : result.success === 0 ? (
                                                <XCircle className="w-6 h-6 text-red-600" />
                                            ) : (
                                                <AlertTriangle className="w-6 h-6 text-amber-600" />
                                            )}

                                            {/* DB Creation Stats */}
                                            {(result.stats && (result.stats.createdSubjects > 0 || result.stats.createdTopics > 0 || result.stats.createdSubtopics > 0)) && (
                                                <div className="mt-3 pt-3 border-t border-black/5 text-xs">
                                                    <p className="font-semibold mb-1 text-gray-700">Database Updates:</p>
                                                    <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                                                        {result.stats.createdSubjects > 0 && (
                                                            <li>Created {result.stats.createdSubjects} new Subject(s)</li>
                                                        )}
                                                        {result.stats.createdTopics > 0 && (
                                                            <li>Created {result.stats.createdTopics} new Topic(s)</li>
                                                        )}
                                                        {result.stats.createdSubtopics > 0 && (
                                                            <li>Created {result.stats.createdSubtopics} new Subtopic(s)</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {result.success} questions imported successfully
                                                    {result.failed > 0 && `, ${result.failed} failed`}
                                                </p>
                                                {result.errors.length > 0 && (
                                                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                                                        {result.errors.slice(0, 5).map((err, i) => (
                                                            <li key={i}>• {err}</li>
                                                        ))}
                                                        {result.errors.length > 5 && (
                                                            <li>...and {result.errors.length - 5} more errors</li>
                                                        )}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
