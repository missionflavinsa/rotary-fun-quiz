'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, RefreshCw, Edit2, FileQuestion, Search, Sparkles, ImagePlus, X, Check, Loader2, Brain, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { CSVUploader } from '@/components/csv/CSVUploader'
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
    image_url: string | null
    solution_text?: string | null
    solution_image_url?: string | null
    assigned_classes?: string[]
    subtopics?: { name: string; topics?: { name: string; subjects?: { name: string } } } | null
}

type ClassItem = { id: string; name: string; section: string }
type Subtopic = { id: string; name: string; topic_id: string }
type Topic = { id: string; name: string; subject_id: string }
type Subject = { id: string; name: string; class_id: string }

export default function QuestionsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [generatingAI, setGeneratingAI] = useState(false)
    const [aiModel, setAiModel] = useState('openai')

    const [questions, setQuestions] = useState<Question[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [subtopics, setSubtopics] = useState<Subtopic[]>([])

    const [filterDifficulty, setFilterDifficulty] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [showBulkUpload, setShowBulkUpload] = useState(false)
    const [classDropdownOpen, setClassDropdownOpen] = useState(false)

    // Bulk Edit State
    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
    const [isBulkEditMode, setIsBulkEditMode] = useState(false)
    const [showBulkEditModal, setShowBulkEditModal] = useState(false)
    const [bulkEditClasses, setBulkEditClasses] = useState<string[]>([])

    // AI Generation Progress State
    const [aiProgress, setAiProgress] = useState<{
        show: boolean;
        currentStep: string;
        steps: { name: string; status: string; }[];
        isDuplicate?: boolean;
        similarityScore?: number;
    }>({ show: false, currentStep: '', steps: [] })

    // Difficulty label mapping
    const DIFFICULTY_LABELS: Record<string, string> = { easy: 'NCERT', medium: 'Foundation', hard: 'Advance' }
    const DIFFICULTY_VALUES = [{ value: 'easy', label: 'NCERT' }, { value: 'medium', label: 'Foundation' }, { value: 'hard', label: 'Advance' }]

    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
    const [formSubject, setFormSubject] = useState('')
    const [formTopic, setFormTopic] = useState('')
    const [formType, setFormType] = useState('mcq')
    const [formOptions, setFormOptions] = useState(['', '', '', ''])
    const [formCorrectAnswer, setFormCorrectAnswer] = useState('')
    const [selectedClasses, setSelectedClasses] = useState<string[]>([])
    const [formSolutionText, setFormSolutionText] = useState('')
    const [solutionImageFile, setSolutionImageFile] = useState<File | null>(null)
    const [solutionImagePreview, setSolutionImagePreview] = useState<string>('')

    const supabase = createClient()

    const fetchData = async () => {
        setFetching(true)
        const [questionsRes, classesRes, subjectsRes, topicsRes, subtopicsRes, linksRes] = await Promise.all([
            supabase.from('questions').select('*, subtopics(name, topics(name, subjects(name)))').order('created_at', { ascending: false }),
            supabase.from('classes').select('id, name, section'),
            supabase.from('subjects').select('id, name, class_id'),
            supabase.from('topics').select('id, name, subject_id'),
            supabase.from('subtopics').select('id, name, topic_id'),
            supabase.from('question_class_links').select('question_id, class_id')
        ])

        if (classesRes.data) setClasses(classesRes.data)
        if (subjectsRes.data) setSubjects(subjectsRes.data)
        if (topicsRes.data) setTopics(topicsRes.data)
        if (subtopicsRes.data) setSubtopics(subtopicsRes.data)

        // Merge class links into questions
        if (questionsRes.data && linksRes.data) {
            const classLinksMap: Record<string, string[]> = {}
            linksRes.data.forEach((link: { question_id: string; class_id: string }) => {
                if (!classLinksMap[link.question_id]) classLinksMap[link.question_id] = []
                classLinksMap[link.question_id].push(link.class_id)
            })
            setQuestions(questionsRes.data.map(q => ({ ...q, assigned_classes: classLinksMap[q.id] || [] })) as Question[])
        } else if (questionsRes.data) {
            setQuestions(questionsRes.data as Question[])
        }
        setFetching(false)
    }

    useEffect(() => {
        fetchData()

        // Subscribe to realtime changes on questions and question_class_links
        const questionsChannel = supabase
            .channel('questions-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => {
                fetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'question_class_links' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(questionsChannel)
        }
    }, [])

    // Generate question with AI - with progress tracking
    const handleGenerateAI = async () => {
        const topicName = formTopic ? topics.find(t => t.id === formTopic)?.name : 'General Knowledge'
        const subjectName = formSubject ? subjects.find(s => s.id === formSubject)?.name : 'General'

        setGeneratingAI(true)
        setAiProgress({
            show: true,
            currentStep: 'Checking existing questions...',
            steps: [
                { name: 'Checking existing questions...', status: 'in_progress' },
                { name: 'Analyzing difficulty patterns...', status: 'pending' },
                { name: 'Generating new question...', status: 'pending' },
                { name: 'Verifying uniqueness...', status: 'pending' },
                { name: 'Question ready!', status: 'pending' }
            ]
        })

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

                // Update progress to complete
                setAiProgress(prev => ({
                    ...prev,
                    currentStep: 'Question ready!',
                    steps: prev.steps.map(s => ({ ...s, status: 'completed' })),
                    isDuplicate: q?.is_duplicate,
                    similarityScore: q?.similarity_score
                }))

                if (q) {
                    // Fill the form with AI data
                    const contentInput = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
                    if (contentInput) contentInput.value = q.question || q.content || ''

                    if (q.options && Array.isArray(q.options)) {
                        setFormOptions(q.options.slice(0, 4))
                    }
                    setFormCorrectAnswer(q.correct_answer || q.answer || '')

                    // Show duplicate warning if applicable
                    if (q.is_duplicate) {
                        alert(`⚠️ Similar question detected (${Math.round(q.similarity_score * 100)}% match). Please review before saving.`)
                    }
                }
            } else {
                setAiProgress(prev => ({ ...prev, currentStep: 'Generation failed', steps: prev.steps.map((s, i) => ({ ...s, status: i < 2 ? 'completed' : 'error' })) }))
            }
        } catch (err) {
            console.error('AI generation failed:', err)
            setAiProgress(prev => ({ ...prev, currentStep: 'Error occurred', steps: prev.steps.map(s => ({ ...s, status: 'error' })) }))
            alert('AI generation failed. Please try again.')
        }

        // Hide progress after a short delay
        setTimeout(() => setAiProgress(prev => ({ ...prev, show: false })), 2000)
        setGeneratingAI(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const form = e.target as HTMLFormElement
        const formData = new FormData(form)

        const content = formData.get('content') as string
        const type = formData.get('type') as string
        const points = parseInt(formData.get('points') as string) || 10
        const difficulty = formData.get('difficulty') as string
        const subtopicId = formData.get('subtopic_id') as string

        // Upload solution image if provided
        let solutionImageUrl = editingQuestion?.solution_image_url || null
        if (solutionImageFile) {
            const fileExt = solutionImageFile.name.split('.').pop()
            const fileName = `solution_${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage
                .from('question-images')
                .upload(fileName, solutionImageFile)

            if (uploadError) {
                console.error('Upload error:', uploadError)
                alert('Failed to upload solution image')
            } else {
                const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(fileName)
                solutionImageUrl = urlData.publicUrl
            }
        }

        let options = null
        if (type === 'mcq') {
            options = formOptions.filter(Boolean)
        }

        const questionData = {
            content,
            type,
            options,
            correct_answer: formCorrectAnswer,
            points,
            difficulty,
            subtopic_id: subtopicId || null,
            solution_text: formSolutionText || null,
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
            if (editingQuestion) {
                await supabase.from('question_class_links').delete().eq('question_id', questionId)
            }
            const linksToInsert = selectedClasses.map(classId => ({ question_id: questionId, class_id: classId }))
            await supabase.from('question_class_links').insert(linksToInsert)
        }

        setIsLoading(false)
        setIsModalOpen(false)
        resetForm()
        fetchData()
    }

    const resetForm = () => {
        setEditingQuestion(null)
        setFormSubject('')
        setFormTopic('')
        setFormType('mcq')
        setFormOptions(['', '', '', ''])
        setFormCorrectAnswer('')
        setSelectedClasses([])
        setFormSolutionText('')
        setSolutionImageFile(null)
        setSolutionImagePreview('')
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

        // Delete related records first for all selected questions
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

    const openEditModal = (q: Question) => {
        setEditingQuestion(q)
        setFormType(q.type)
        setFormOptions(q.options || ['', '', '', ''])
        setFormCorrectAnswer(q.correct_answer)
        setSelectedClasses(q.assigned_classes || [])
        setFormSolutionText(q.solution_text || '')
        setSolutionImageFile(null)
        setSolutionImagePreview(q.solution_image_url || '')

        // Fix: Populate Subject and Topic based on subtopic_id
        if (q.subtopic_id) {
            const subtopic = subtopics.find(s => s.id === q.subtopic_id)
            if (subtopic) {
                setFormTopic(subtopic.topic_id)
                const topic = topics.find(t => t.id === subtopic.topic_id)
                if (topic) {
                    setFormSubject(topic.subject_id)
                }
            }
        } else {
            setFormSubject('')
            setFormTopic('')
        }

        setIsModalOpen(true)
    }

    const filteredQuestions = questions.filter(q => {
        if (filterDifficulty && q.difficulty !== filterDifficulty) return false
        if (searchQuery && !q.content.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    const filteredTopics = formSubject ? topics.filter(t => t.subject_id === formSubject) : []
    const filteredSubtopics = formTopic ? subtopics.filter(s => s.topic_id === formTopic) : []

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                        Question Bank
                    </h1>
                    <p className="text-gray-500 mt-1">Manage quiz questions with AI assistance</p>
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
                        onClick={() => { resetForm(); setIsModalOpen(true) }}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl hover:from-violet-700 hover:to-fuchsia-700 transition shadow-lg shadow-violet-500/30 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Add Question
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                </div>
                <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-200 bg-white"
                >
                    <option value="">All Difficulties</option>
                    <option value="easy">NCERT</option>
                    <option value="medium">Foundation</option>
                    <option value="hard">Advance</option>
                </select>
            </div>

            {/* Bulk Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
                <button
                    onClick={() => setShowBulkUpload(!showBulkUpload)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                    <div className="flex items-center gap-3">
                        <Upload className="w-5 h-5 text-violet-600" />
                        <span className="font-medium text-gray-700">Bulk Upload / Export Questions (CSV)</span>
                    </div>
                    {showBulkUpload ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                <AnimatePresence>
                    {showBulkUpload && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-5 pb-5 border-t border-gray-100"
                        >
                            <div className="pt-4">
                                <CSVUploader type="questions" onSuccess={fetchData} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* JSON Import from ChatGPT */}
            <JSONQuestionImporter
                classes={classes}
                subjects={subjects}
                topics={topics}
                subtopics={subtopics}
                onSuccess={fetchData}
            />

            {/* Bulk Edit Toolbar */}
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
                            onClick={() => setShowBulkEditModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition"
                        >
                            <Edit2 className="w-4 h-4" />
                            Bulk Edit
                        </button>
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

            {/* AI Generation Progress Overlay */}
            <AnimatePresence>
                {aiProgress.show && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">AI Question Generator</h3>
                                    <p className="text-sm text-gray-500">{aiProgress.currentStep}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {aiProgress.steps.map((step, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.status === 'completed' ? 'bg-green-500' :
                                            step.status === 'in_progress' ? 'bg-violet-500 animate-pulse' :
                                                step.status === 'error' ? 'bg-red-500' :
                                                    'bg-gray-200'
                                            }`}>
                                            {step.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                                            {step.status === 'in_progress' && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                                            {step.status === 'error' && <X className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`text-sm ${step.status === 'completed' ? 'text-green-700' :
                                            step.status === 'in_progress' ? 'text-violet-700 font-medium' :
                                                step.status === 'error' ? 'text-red-700' :
                                                    'text-gray-400'
                                            }`}>
                                            {step.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {aiProgress.isDuplicate && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                                    <p className="text-sm text-amber-800">
                                        ⚠️ Similar question detected ({Math.round((aiProgress.similarityScore || 0) * 100)}% match)
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Questions List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {fetching ? (
                    <div className="p-12 text-center text-gray-500">
                        <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-violet-500" />
                        Loading questions...
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredQuestions.map((q, idx) => (
                            <motion.div
                                key={q.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className={`p-5 hover:bg-gray-50/50 transition group ${selectedQuestions.includes(q.id) ? 'bg-violet-50' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    {/* Checkbox for bulk select */}
                                    <label className="flex items-center mt-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedQuestions.includes(q.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedQuestions([...selectedQuestions, q.id])
                                                } else {
                                                    setSelectedQuestions(selectedQuestions.filter(id => id !== q.id))
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                        />
                                    </label>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 mb-3 leading-relaxed">{q.content}</p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <span className={`px-2.5 py-1 rounded-full font-medium ${q.type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                                                q.type === 'integer' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {q.type?.toUpperCase()}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-full font-medium ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                                q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {DIFFICULTY_LABELS[q.difficulty] || 'Foundation'}
                                            </span>
                                            <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-medium">
                                                {q.points} pts
                                            </span>
                                            {q.assigned_classes && q.assigned_classes.length > 0 && (
                                                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                                                    {q.assigned_classes.length} class{q.assigned_classes.length > 1 ? 'es' : ''}
                                                </span>
                                            )}
                                        </div>
                                        {/* Show class names */}
                                        {q.assigned_classes && q.assigned_classes.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {q.assigned_classes.slice(0, 5).map(cid => {
                                                    const c = classes.find(cls => cls.id === cid)
                                                    return c ? (
                                                        <span key={cid} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">
                                                            {c.name} {c.section}
                                                        </span>
                                                    ) : null
                                                })}
                                                {q.assigned_classes.length > 5 && (
                                                    <span className="text-xs text-gray-400">+{q.assigned_classes.length - 5} more</span>
                                                )}
                                            </div>
                                        )}
                                        {q.type === 'mcq' && q.options && (
                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${opt === q.correct_answer
                                                        ? 'bg-green-100 text-green-700 font-medium'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {String.fromCharCode(65 + i)}. {opt}
                                                        {opt === q.correct_answer && <Check className="w-3 h-3 inline ml-1" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => openEditModal(q)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                                            <Edit2 className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <button onClick={() => handleDelete(q.id)} className="p-2 hover:bg-red-100 rounded-lg transition">
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        {filteredQuestions.length === 0 && (
                            <div className="p-16 text-center text-gray-500">
                                <FileQuestion className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                                <p className="text-lg font-medium text-gray-600">No questions found</p>
                                <p className="text-sm">Add your first question or try AI generation</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Enhanced Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm() }}
                title={editingQuestion ? 'Edit Question' : 'Create New Question'}
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* AI Generation Button */}
                    <div className="flex items-center justify-end gap-3">
                        <select
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
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

                    {/* Question Content */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Question</label>
                        <textarea
                            name="content"
                            required
                            rows={4}
                            defaultValue={editingQuestion?.content || ''}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none text-gray-800"
                            placeholder="Enter your question here..."
                            style={{ scrollbarWidth: 'none' }}
                        />
                    </div>

                    {/* Type and Difficulty */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                            <select
                                name="type"
                                value={formType}
                                onChange={(e) => setFormType(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                            >
                                <option value="mcq">Multiple Choice</option>
                                <option value="integer">Numeric Answer</option>
                                <option value="subjective">Subjective</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Difficulty Level</label>
                            <div className="flex gap-2">
                                {DIFFICULTY_VALUES.map((d) => (
                                    <label key={d.value} className="flex-1">
                                        <input type="radio" name="difficulty" value={d.value} defaultChecked={d.value === (editingQuestion?.difficulty || 'medium')} className="sr-only peer" />
                                        <div className={`text-center py-2.5 rounded-xl border-2 cursor-pointer transition font-medium text-sm peer-checked:border-violet-500 peer-checked:bg-violet-50 peer-checked:text-violet-700 ${d.value === 'easy' ? 'border-emerald-200 hover:bg-emerald-50' :
                                            d.value === 'medium' ? 'border-amber-200 hover:bg-amber-50' :
                                                'border-red-200 hover:bg-red-50'
                                            }`}>
                                            {d.label}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Points */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Points</label>
                        <div className="flex gap-2">
                            {[5, 10, 15, 20, 25].map((p) => (
                                <label key={p} className="flex-1">
                                    <input type="radio" name="points" value={p} defaultChecked={p === (editingQuestion?.points || 10)} className="sr-only peer" />
                                    <div className="text-center py-2 rounded-xl border-2 border-gray-200 cursor-pointer transition font-bold peer-checked:border-violet-500 peer-checked:bg-violet-50 peer-checked:text-violet-700 hover:bg-gray-50">
                                        {p}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* MCQ Options */}
                    <AnimatePresence>
                        {formType === 'mcq' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3"
                            >
                                <label className="block text-sm font-semibold text-gray-700">Answer Options</label>
                                {formOptions.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${opt === formCorrectAnswer ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...formOptions]
                                                newOpts[idx] = e.target.value
                                                setFormOptions(newOpts)
                                            }}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
                                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormCorrectAnswer(opt)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${opt === formCorrectAnswer
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                                                }`}
                                        >
                                            {opt === formCorrectAnswer ? <Check className="w-4 h-4" /> : 'Set Correct'}
                                        </button>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Correct Answer for non-MCQ */}
                    {formType !== 'mcq' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Answer</label>
                            <input
                                type="text"
                                value={formCorrectAnswer}
                                onChange={(e) => setFormCorrectAnswer(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none"
                                placeholder="Enter the correct answer"
                            />
                        </div>
                    )}

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Category (Optional)</label>
                        <div className="grid grid-cols-3 gap-2">
                            <select
                                value={formSubject}
                                onChange={(e) => { setFormSubject(e.target.value); setFormTopic('') }}
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                            >
                                <option value="">Subject</option>
                                {subjects.map(s => {
                                    const cls = classes.find(c => c.id === s.class_id)
                                    return <option key={s.id} value={s.id}>{s.name} {cls ? `(${cls.name}-${cls.section})` : ''}</option>
                                })}
                            </select>
                            <select
                                value={formTopic}
                                onChange={(e) => setFormTopic(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                            >
                                <option value="">Topic</option>
                                {filteredTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select
                                name="subtopic_id"
                                defaultValue={editingQuestion?.subtopic_id || ''}
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                            >
                                <option value="">Subtopic</option>
                                {filteredSubtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Assign to Classes - Dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to Classes</label>
                        {/* Selected Classes Pills */}
                        {selectedClasses.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedClasses.map(cid => {
                                    const c = classes.find(cls => cls.id === cid)
                                    return c ? (
                                        <span key={cid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                                            {c.name} {c.section}
                                            <button type="button" onClick={() => setSelectedClasses(selectedClasses.filter(id => id !== cid))} className="hover:text-violet-900">
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
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between hover:border-violet-300 transition"
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
                                    className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                                >
                                    {classes.map(c => (
                                        <label key={c.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-violet-50 cursor-pointer border-b border-gray-50 last:border-0">
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
                                                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                            />
                                            <span className="text-sm text-gray-700">{c.name} <span className="text-gray-400">({c.section})</span></span>
                                        </label>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Solution (Optional) - for integer/subjective */}
                    <AnimatePresence>
                        {(formType === 'integer' || formType === 'subjective') && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 border-t pt-4"
                            >
                                <label className="block text-sm font-semibold text-gray-700">Solution (Optional)</label>
                                <textarea
                                    value={formSolutionText}
                                    onChange={(e) => setFormSolutionText(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none text-sm"
                                    placeholder="Enter detailed solution explanation..."
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
                                        {solutionImagePreview && (
                                            <div className="relative">
                                                <img
                                                    src={solutionImagePreview}
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
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => { setIsModalOpen(false); resetForm() }}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:from-violet-700 hover:to-fuchsia-700 transition disabled:opacity-50 font-medium flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    {editingQuestion ? 'Update Question' : 'Create Question'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Bulk Edit Modal */}
            <Modal
                isOpen={showBulkEditModal}
                onClose={() => { setShowBulkEditModal(false); setBulkEditClasses([]) }}
                title={`Bulk Edit ${selectedQuestions.length} Questions`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Assign these {selectedQuestions.length} questions to additional classes:
                    </p>

                    {/* Class Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Add to Classes</label>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
                            {classes.map(c => (
                                <label key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border cursor-pointer hover:bg-violet-50 hover:border-violet-300 transition text-sm">
                                    <input
                                        type="checkbox"
                                        checked={bulkEditClasses.includes(c.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setBulkEditClasses([...bulkEditClasses, c.id])
                                            } else {
                                                setBulkEditClasses(bulkEditClasses.filter(id => id !== c.id))
                                            }
                                        }}
                                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                    />
                                    <span>{c.name} {c.section}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => { setShowBulkEditModal(false); setBulkEditClasses([]) }}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                if (bulkEditClasses.length === 0) {
                                    alert('Please select at least one class')
                                    return
                                }
                                // Insert class links for all selected questions
                                const links = selectedQuestions.flatMap(qId =>
                                    bulkEditClasses.map(cId => ({ question_id: qId, class_id: cId }))
                                )
                                const { error } = await supabase.from('question_class_links').upsert(links, { onConflict: 'question_id,class_id' })
                                if (error) {
                                    alert('Error: ' + error.message)
                                } else {
                                    setShowBulkEditModal(false)
                                    setBulkEditClasses([])
                                    setSelectedQuestions([])
                                    fetchData()
                                }
                            }}
                            disabled={bulkEditClasses.length === 0}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:from-violet-700 hover:to-fuchsia-700 transition disabled:opacity-50 font-medium flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            Apply to {selectedQuestions.length} Questions
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
