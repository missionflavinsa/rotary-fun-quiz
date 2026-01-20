'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, RefreshCw, Edit2, FileQuestion, Search, Upload, X, ChevronDown, ChevronUp, Brain, Loader2, Sparkles, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { JSONQuestionImporter } from '@/components/questions/JSONQuestionImporter'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

type Question = {
    id: string
    content: string
    type: string
    options: string[] | null
    correct_answer: string
    points: number
    difficulty: string
    subtopic_id: string | null
    solution_text?: string | null
    solution_image_url?: string | null
    assigned_classes?: string[]
}

type ClassItem = { id: string; name: string; section: string }
type Subtopic = { id: string; name: string; topic_id: string }
type Topic = { id: string; name: string; subject_id: string }
type Subject = { id: string; name: string; class_id?: string }

export default function TeacherQuestionsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    const [questions, setQuestions] = useState<Question[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [subtopics, setSubtopics] = useState<Subtopic[]>([])

    const [searchQuery, setSearchQuery] = useState('')
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
    const [formSubject, setFormSubject] = useState('')
    const [formTopic, setFormTopic] = useState('')
    const [selectedClasses, setSelectedClasses] = useState<string[]>([])
    const [solutionImageFile, setSolutionImageFile] = useState<File | null>(null)
    const [solutionImagePreview, setSolutionImagePreview] = useState<string>('')
    const [classDropdownOpen, setClassDropdownOpen] = useState(false)

    // Bulk Edit State
    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])

    // AI Generation State
    const [generatingAI, setGeneratingAI] = useState(false)
    const [aiModel, setAiModel] = useState('gemini')
    const [formType, setFormType] = useState('mcq')
    const [formOptions, setFormOptions] = useState(['', '', '', ''])
    const [formCorrectAnswer, setFormCorrectAnswer] = useState('')

    const supabase = createClient()

    const fetchData = async () => {
        setFetching(true)

        const [questionsRes, classesRes, subjectsRes, topicsRes, subtopicsRes, linksRes] = await Promise.all([
            supabase.from('questions').select('id, content, type, options, correct_answer, points, difficulty, subtopic_id, solution_text, solution_image_url').order('created_at', { ascending: false }),
            supabase.from('classes').select('id, name, section').order('name'),
            supabase.from('subjects').select('id, name, class_id'),
            supabase.from('topics').select('id, name, subject_id'),
            supabase.from('subtopics').select('id, name, topic_id'),
            supabase.from('question_class_links').select('question_id, class_id')
        ])

        if (classesRes.data) setClasses(classesRes.data)
        if (subjectsRes.data) setSubjects(subjectsRes.data as Subject[])
        if (topicsRes.data) setTopics(topicsRes.data)
        if (subtopicsRes.data) setSubtopics(subtopicsRes.data)

        // Merge class links into questions
        if (questionsRes.data && linksRes.data) {
            const classLinksMap: Record<string, string[]> = {}
            linksRes.data.forEach((link: { question_id: string; class_id: string }) => {
                if (!classLinksMap[link.question_id]) classLinksMap[link.question_id] = []
                classLinksMap[link.question_id].push(link.class_id)
            })
            setQuestions(questionsRes.data.map(q => ({ ...q, assigned_classes: classLinksMap[q.id] || [] })))
        } else if (questionsRes.data) {
            setQuestions(questionsRes.data)
        }

        setFetching(false)
    }

    useEffect(() => {
        fetchData()

        // Subscribe to realtime changes on questions and question_class_links
        const channel = supabase
            .channel('teacher-questions-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => {
                fetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'question_class_links' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true)

        const content = formData.get('content') as string
        const type = formData.get('type') as string
        const correctAnswer = formData.get('correct_answer') as string
        const points = parseInt(formData.get('points') as string) || 10
        const difficulty = formData.get('difficulty') as string
        const subtopicId = formData.get('subtopic_id') as string
        const solutionText = formData.get('solution_text') as string

        // Upload solution image if provided
        let solutionImageUrl = editingQuestion?.solution_image_url || null
        if (solutionImageFile) {
            const fileExt = solutionImageFile.name.split('.').pop()
            const fileName = `solution_${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('solutions').upload(fileName, solutionImageFile)
            if (!uploadError) {
                const { data: publicUrl } = supabase.storage.from('solutions').getPublicUrl(fileName)
                solutionImageUrl = publicUrl.publicUrl
            }
        }

        let options = null
        if (type === 'mcq') {
            options = [
                formData.get('option_a') as string,
                formData.get('option_b') as string,
                formData.get('option_c') as string,
                formData.get('option_d') as string
            ].filter(Boolean)
        }

        const questionData = {
            content,
            type,
            options,
            correct_answer: correctAnswer,
            points,
            difficulty,
            subtopic_id: subtopicId || null,
            solution_text: solutionText || null,
            solution_image_url: solutionImageUrl
        }

        let questionId = editingQuestion?.id

        if (editingQuestion) {
            const { error } = await supabase.from('questions').update(questionData).eq('id', editingQuestion.id)
            if (error) { alert(error.message); setIsLoading(false); return }
        } else {
            const { data, error } = await supabase.from('questions').insert(questionData).select('id').single()
            if (error) { alert(error.message); setIsLoading(false); return }
            questionId = data.id
        }

        // Update class links
        if (questionId && selectedClasses.length > 0) {
            // Delete existing links first (for editing)
            if (editingQuestion) {
                await supabase.from('question_class_links').delete().eq('question_id', questionId)
            }
            // Insert new links
            const linksToInsert = selectedClasses.map(classId => ({ question_id: questionId, class_id: classId }))
            const { error: linkError } = await supabase.from('question_class_links').insert(linksToInsert)
            if (linkError) console.error('Error inserting class links:', linkError.message)
        }

        setIsLoading(false)
        setIsModalOpen(false)
        setEditingQuestion(null)
        setSelectedClasses([])
        fetchData()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this question?')) return
        // Delete related records first
        await supabase.from('question_class_links').delete().eq('question_id', id)
        await supabase.from('game_questions').delete().eq('question_id', id)
        const { error } = await supabase.from('questions').delete().eq('id', id)
        if (error) alert(error.message)
        fetchData()
    }

    const handleBulkDeleteQuestions = async () => {
        if (!confirm(`Delete ${selectedQuestions.length} questions? This cannot be undone.`)) return

        // Delete related records first
        await supabase.from('question_class_links').delete().in('question_id', selectedQuestions)
        await supabase.from('game_questions').delete().in('question_id', selectedQuestions)

        const { error } = await supabase.from('questions').delete().in('id', selectedQuestions)
        if (error) {
            alert(error.message)
        } else {
            setSelectedQuestions([])
            fetchData()
        }
    }

    const toggleAllQuestions = () => {
        if (selectedQuestions.length === filteredQuestions.length) {
            setSelectedQuestions([])
        } else {
            setSelectedQuestions(filteredQuestions.map(q => q.id))
        }
    }

    // Generate question with AI
    const handleGenerateAI = async () => {
        const topicName = formTopic ? topics.find(t => t.id === formTopic)?.name : 'General Knowledge'
        const subjectName = formSubject ? subjects.find(s => s.id === formSubject)?.name : 'General'

        setGeneratingAI(true)

        try {
            const res = await fetch('/api/generate-question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subjectName || 'General Knowledge',
                    topic: topicName || 'General',
                    difficulty: 'medium',
                    model: aiModel,
                    usePythonBackend: true
                })
            })

            if (res.ok) {
                const data = await res.json()
                const q = data.question

                if (q) {
                    // Fill the form with AI data
                    const contentInput = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
                    if (contentInput) contentInput.value = q.question || q.content || ''

                    if (q.options && Array.isArray(q.options)) {
                        setFormOptions(q.options.slice(0, 4))
                        // Also fill the form inputs directly
                        const optionInputs = document.querySelectorAll('input[name^="option_"]') as NodeListOf<HTMLInputElement>
                        q.options.slice(0, 4).forEach((opt: string, i: number) => {
                            if (optionInputs[i]) optionInputs[i].value = opt
                        })
                    }

                    const correctAnswerInput = document.querySelector('input[name="correct_answer"]') as HTMLInputElement
                    if (correctAnswerInput) correctAnswerInput.value = q.correct_answer || q.answer || ''
                    setFormCorrectAnswer(q.correct_answer || q.answer || '')

                    if (q.is_duplicate) {
                        alert(`⚠️ Similar question detected (${Math.round(q.similarity_score * 100)}% match). Please review before saving.`)
                    }
                }
            } else {
                alert('AI generation failed. Please try again.')
            }
        } catch (err) {
            console.error('AI generation failed:', err)
            alert('AI generation failed. Please try again.')
        }

        setGeneratingAI(false)
    }

    const filteredQuestions = questions.filter(q => {
        if (searchQuery && !q.content.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    const filteredTopics = formSubject ? topics.filter(t => t.subject_id === formSubject) : []
    const filteredSubtopics = formTopic ? subtopics.filter(s => s.topic_id === formTopic) : []

    const getClassLabel = (classId: string) => {
        const c = classes.find(cls => cls.id === classId)
        return c ? `${c.name} ${c.section}` : ''
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        My Questions
                    </h1>
                    <p className="text-gray-500 mt-1">Create and manage quiz questions</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchData}
                        disabled={fetching}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => { setEditingQuestion(null); setFormSubject(''); setFormTopic(''); setSelectedClasses([]); setIsModalOpen(true) }}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30"
                    >
                        <Plus className="w-5 h-5" />
                        Add Question
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                </div>
            </div>

            {/* JSON Import from ChatGPT */}
            <JSONQuestionImporter
                classes={classes}
                subjects={subjects}
                topics={topics}
                subtopics={subtopics}
                onSuccess={fetchData}
            />

            {/* Bulk Delete Toolbar */}
            <AnimatePresence>
                {selectedQuestions.length > 0 && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50"
                    >
                        <span className="font-medium">{selectedQuestions.length} selected</span>
                        <div className="h-6 w-px bg-white/20"></div>
                        <button
                            onClick={handleBulkDeleteQuestions}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                        <button
                            onClick={() => setSelectedQuestions([])}
                            className="p-2 hover:bg-white/10 rounded-lg transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Questions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {fetching ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-500" />
                        Loading...
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {/* Select All Header */}
                        {filteredQuestions.length > 0 && (
                            <div className="px-4 py-3 bg-gray-50 flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedQuestions.length === filteredQuestions.length}
                                    onChange={toggleAllQuestions}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-600">Select All ({filteredQuestions.length})</span>
                            </div>
                        )}
                        {filteredQuestions.map((q, idx) => (
                            <motion.div
                                key={q.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`p-4 hover:bg-gray-50 transition ${selectedQuestions.includes(q.id) ? 'bg-indigo-50' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedQuestions.includes(q.id)}
                                        onChange={() => {
                                            if (selectedQuestions.includes(q.id)) {
                                                setSelectedQuestions(prev => prev.filter(id => id !== q.id))
                                            } else {
                                                setSelectedQuestions(prev => [...prev, q.id])
                                            }
                                        }}
                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 mb-2">{q.content}</p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <span className={`px-2 py-1 rounded-full ${q.type === 'mcq' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {q.type?.toUpperCase()}
                                            </span>
                                            <span className={`px-2 py-1 rounded-full ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                                q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {q.difficulty || 'medium'}
                                            </span>
                                            <span className="px-2 py-1 rounded-full bg-violet-100 text-violet-700">
                                                {q.points} pts
                                            </span>
                                            {q.assigned_classes && q.assigned_classes.length > 0 && (
                                                <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                                                    {q.assigned_classes.length} class{q.assigned_classes.length > 1 ? 'es' : ''}
                                                </span>
                                            )}
                                        </div>
                                        {/* Show class names */}
                                        {q.assigned_classes && q.assigned_classes.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {q.assigned_classes.slice(0, 5).map(cid => (
                                                    <span key={cid} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                        {getClassLabel(cid)}
                                                    </span>
                                                ))}
                                                {q.assigned_classes.length > 5 && (
                                                    <span className="text-xs text-gray-400">+{q.assigned_classes.length - 5} more</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setEditingQuestion(q); setSelectedClasses(q.assigned_classes || []); setIsModalOpen(true) }}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                                        >
                                            <Edit2 className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(q.id)}
                                            className="p-2 hover:bg-red-50 rounded-lg transition"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        {filteredQuestions.length === 0 && (
                            <div className="p-12 text-center text-gray-500">
                                <FileQuestion className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No questions yet. Add one!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingQuestion(null) }}
                title={editingQuestion ? 'Edit Question' : 'Add Question'}
            >
                <form action={handleSubmit} className="space-y-4">
                    {/* AI Generation Button */}
                    <div className="flex items-center justify-end gap-3 pb-2 border-b border-gray-100">
                        <select
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        >
                            <option value="gemini">Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="claude">Claude</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="grok">Grok</option>
                            <option value="local">Local LLM (Ollama)</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleGenerateAI}
                            disabled={generatingAI}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition text-sm font-medium disabled:opacity-50"
                        >
                            {generatingAI ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Brain className="w-4 h-4" />
                                    Generate with AI
                                </>
                            )}
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                        <textarea
                            name="content"
                            required
                            rows={3}
                            defaultValue={editingQuestion?.content || ''}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 resize-none"
                            placeholder="Enter question..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select name="type" defaultValue={editingQuestion?.type || 'mcq'} className="w-full px-4 py-2 rounded-lg border border-gray-200">
                                <option value="mcq">MCQ</option>
                                <option value="integer">Integer</option>
                                <option value="subjective">Subjective</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                            <select name="difficulty" defaultValue={editingQuestion?.difficulty || 'medium'} className="w-full px-4 py-2 rounded-lg border border-gray-200">
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                            <input name="points" type="number" defaultValue={editingQuestion?.points || 10} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                            <input name="correct_answer" type="text" required defaultValue={editingQuestion?.correct_answer || ''} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">MCQ Options</label>
                        <input name="option_a" placeholder="Option A" defaultValue={editingQuestion?.options?.[0] || ''} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                        <input name="option_b" placeholder="Option B" defaultValue={editingQuestion?.options?.[1] || ''} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                        <input name="option_c" placeholder="Option C" defaultValue={editingQuestion?.options?.[2] || ''} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                        <input name="option_d" placeholder="Option D" defaultValue={editingQuestion?.options?.[3] || ''} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <select value={formSubject} onChange={(e) => { setFormSubject(e.target.value); setFormTopic('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                            <option value="">Subject</option>
                            {subjects.map(s => {
                                const cls = classes.find(c => c.id === s.class_id)
                                return <option key={s.id} value={s.id}>{s.name} {cls ? `(${cls.name}-${cls.section})` : ''}</option>
                            })}
                        </select>
                        <select value={formTopic} onChange={(e) => setFormTopic(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                            <option value="">Topic</option>
                            {filteredTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select name="subtopic_id" defaultValue={editingQuestion?.subtopic_id || ''} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                            <option value="">Subtopic</option>
                            {filteredSubtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    {/* Assign to Classes - Dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Classes</label>
                        {/* Selected Classes Pills */}
                        {selectedClasses.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedClasses.map(cid => {
                                    const c = classes.find(cls => cls.id === cid)
                                    return c ? (
                                        <span key={cid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                            {c.name} {c.section}
                                            <button type="button" onClick={() => setSelectedClasses(selectedClasses.filter(id => id !== cid))} className="hover:text-indigo-900">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ) : null
                                })}
                            </div>
                        )}
                        {/* Dropdown Trigger */}
                        <button
                            type="button"
                            onClick={() => setClassDropdownOpen(!classDropdownOpen)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white flex items-center justify-between hover:border-indigo-300 transition"
                        >
                            <span className="text-sm text-gray-600">
                                {selectedClasses.length === 0 ? 'Select classes...' : `${selectedClasses.length} class${selectedClasses.length > 1 ? 'es' : ''} selected`}
                            </span>
                            {classDropdownOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>
                        {/* Dropdown List */}
                        <AnimatePresence>
                            {classDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                                >
                                    {classes.map(c => (
                                        <label key={c.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedClasses.includes(c.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedClasses([...selectedClasses, c.id])
                                                    } else {
                                                        setSelectedClasses(selectedClasses.filter(id => id !== c.id))
                                                    }
                                                }}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-700">{c.name} <span className="text-gray-400">({c.section})</span></span>
                                        </label>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Solution (Optional) */}
                    <div className="border-t pt-4 mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Solution (Optional)</label>
                        <textarea
                            name="solution_text"
                            rows={2}
                            defaultValue={editingQuestion?.solution_text || ''}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 resize-none text-sm"
                            placeholder="Enter solution explanation..."
                        />
                        <div className="mt-2">
                            <label className="block text-xs text-gray-500 mb-1">Solution Image</label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition text-sm">
                                    <Upload className="w-4 h-4 text-gray-600" />
                                    <span>{solutionImageFile ? 'Change Image' : 'Upload Image'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                setSolutionImageFile(file)
                                                setSolutionImagePreview(URL.createObjectURL(file))
                                            }
                                        }}
                                    />
                                </label>
                                {(solutionImagePreview || editingQuestion?.solution_image_url) && (
                                    <div className="relative">
                                        <img
                                            src={solutionImagePreview || editingQuestion?.solution_image_url || ''}
                                            alt="Solution"
                                            className="w-16 h-16 object-cover rounded-lg border"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSolutionImageFile(null)
                                                setSolutionImagePreview('')
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => { setIsModalOpen(false); setEditingQuestion(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {isLoading ? 'Saving...' : editingQuestion ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
