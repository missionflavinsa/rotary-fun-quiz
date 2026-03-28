'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
    Sparkles, Play, ChevronRight, Users, BookOpen,
    Layers, FileText, Zap, ArrowLeft, RotateCcw, UserCheck, RefreshCw, Loader2, Brain, Database,
    Pause, ChevronDown, Clock, Trash2, Trophy, UserPlus, CheckSquare
} from 'lucide-react'
import Link from 'next/link'

// Types
type Teacher = { id: string; full_name: string | null; email: string }
type ClassItem = { id: string; name: string; section: string }
type SubjectItem = { id: string; name: string }
type StudentItem = { id: string; full_name: string }
type TopicItem = { id: string; name: string }
type SubtopicItem = { id: string; name: string }
type SavedGame = {
    id: string
    name: string
    class_id: string
    subject_id: string
    num_tabs: number
    game_score: number
    used_student_ids: string[]
    started_at: string
    topic_ids: string[] | null
    subtopic_ids: string[] | null
    classes: { name: string; section: string } | { name: string; section: string }[] | null
    subjects: { name: string } | { name: string }[] | null
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
}

export default function GameSetupPage() {
    const [step, setStep] = useState(1)
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [allStudents, setAllStudents] = useState<StudentItem[]>([])
    const [subjects, setSubjects] = useState<SubjectItem[]>([])
    const [topics, setTopics] = useState<TopicItem[]>([])
    const [subtopics, setSubtopics] = useState<SubtopicItem[]>([])

    const [selectedTeacher, setSelectedTeacher] = useState('')
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
    const [selectedSubject, setSelectedSubject] = useState('')
    const [selectedTopics, setSelectedTopics] = useState<string[]>([])
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([])
    const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(['mcq', 'integer', 'subjective'])
    const [questionSource, setQuestionSource] = useState<'ai' | 'bank' | ''>('')
    const [aiModel, setAiModel] = useState<'gemini' | 'openai' | 'claude' | 'deepseek' | 'grok' | ''>('')
    const [numTabs, setNumTabs] = useState(1)

    // Loading states
    const [loadingTeachers, setLoadingTeachers] = useState(true)
    const [loadingClasses, setLoadingClasses] = useState(true)
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [loadingSubjects, setLoadingSubjects] = useState(false)
    const [loadingTopics, setLoadingTopics] = useState(false)
    const [loadingSubtopics, setLoadingSubtopics] = useState(false)

    // Saved games for resume
    const [savedGames, setSavedGames] = useState<SavedGame[]>([])
    const [loadingSavedGames, setLoadingSavedGames] = useState(true)
    const [showSavedGames, setShowSavedGames] = useState(false)
    const [topicNamesMap, setTopicNamesMap] = useState<Record<string, string>>({})
    const [subtopicNamesMap, setSubtopicNamesMap] = useState<Record<string, string>>({})

    const router = useRouter()
    const supabase = createClient()

    // Fetch teachers on mount
    useEffect(() => {
        const fetchTeachers = async () => {
            setLoadingTeachers(true)
            console.log('Fetching teachers...')
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('role', 'teacher')
            console.log('Teachers result:', data, error)
            if (data) setTeachers(data)
            setLoadingTeachers(false)
        }
        fetchTeachers()
    }, [])

    // Fetch saved/paused games on mount
    useEffect(() => {
        const fetchSavedGames = async () => {
            setLoadingSavedGames(true)
            const { data } = await supabase
                .from('game_sessions')
                .select(`
                    id, name, class_id, subject_id, num_tabs, game_score, used_student_ids, started_at,
                    topic_ids, subtopic_ids,
                    classes(name, section),
                    subjects(name)
                `)
                .eq('status', 'paused')
                .order('started_at', { ascending: false })
                .limit(10)

            if (data) {
                const sessions = data as SavedGame[]
                setSavedGames(sessions)

                // Gather all unique topic and subtopic IDs
                const allTopicIds = new Set<string>()
                const allSubtopicIds = new Set<string>()

                sessions.forEach(s => {
                    s.topic_ids?.forEach(id => allTopicIds.add(id))
                    s.subtopic_ids?.forEach(id => allSubtopicIds.add(id))
                })

                // Fetch Topic Names
                if (allTopicIds.size > 0) {
                    const { data: topicsData } = await supabase
                        .from('topics')
                        .select('id, name')
                        .in('id', Array.from(allTopicIds))

                    if (topicsData) {
                        const tMap: Record<string, string> = {}
                        topicsData.forEach(t => tMap[t.id] = t.name)
                        setTopicNamesMap(tMap)
                    }
                }

                // Fetch Subtopic Names
                if (allSubtopicIds.size > 0) {
                    const { data: subtopicsData } = await supabase
                        .from('subtopics')
                        .select('id, name')
                        .in('id', Array.from(allSubtopicIds))

                    if (subtopicsData) {
                        const sMap: Record<string, string> = {}
                        subtopicsData.forEach(s => sMap[s.id] = s.name)
                        setSubtopicNamesMap(sMap)
                    }
                }
            }
            setLoadingSavedGames(false)
        }
        fetchSavedGames()
    }, [])

    // Fetch classes on mount
    useEffect(() => {
        const fetchClasses = async () => {
            setLoadingClasses(true)
            console.log('Fetching classes...')
            const { data, error } = await supabase
                .from('classes')
                .select('id, name, section')
                .order('name', { ascending: true })
            console.log('Classes result:', data, error)
            if (data) setClasses(data)
            setLoadingClasses(false)
        }
        fetchClasses()
    }, [])

    // Fetch students when class changes
    useEffect(() => {
        if (!selectedClass) {
            setAllStudents([])
            setSelectedStudentIds([])
            return
        }
        const fetchStudents = async () => {
            setLoadingStudents(true)
            const { data, error } = await supabase
                .from('students')
                .select('id, full_name')
                .eq('class_id', selectedClass)
                .order('full_name', { ascending: true })
            console.log('Students for class', selectedClass, ':', data, error)
            if (data) {
                setAllStudents(data)
                // Auto-select all students by default
                setSelectedStudentIds(data.map(s => s.id))
            }
            setLoadingStudents(false)
        }
        fetchStudents()
    }, [selectedClass])

    // Fetch subjects when class changes
    useEffect(() => {
        if (!selectedClass) {
            setSubjects([])
            return
        }
        const fetchSubjects = async () => {
            setLoadingSubjects(true)
            const { data, error } = await supabase
                .from('subjects')
                .select('id, name')
                .eq('class_id', selectedClass)
            console.log('Subjects for class', selectedClass, ':', data, error)
            if (data) setSubjects(data)
            setLoadingSubjects(false)
        }
        fetchSubjects()
    }, [selectedClass])

    // Fetch topics when subject changes
    useEffect(() => {
        if (!selectedSubject) {
            setTopics([])
            return
        }
        const fetchTopics = async () => {
            setLoadingTopics(true)
            const { data, error } = await supabase
                .from('topics')
                .select('id, name')
                .eq('subject_id', selectedSubject)
            console.log('Topics for subject', selectedSubject, ':', data, error)
            if (data) setTopics(data)
            setLoadingTopics(false)
        }
        fetchTopics()
    }, [selectedSubject])

    // Fetch subtopics when topics change
    useEffect(() => {
        if (selectedTopics.length === 0) {
            setSubtopics([])
            return
        }
        const fetchSubtopics = async () => {
            setLoadingSubtopics(true)
            const { data, error } = await supabase
                .from('subtopics')
                .select('id, name')
                .in('topic_id', selectedTopics)
            console.log('Subtopics:', data, error)
            if (data) setSubtopics(data)
            setLoadingSubtopics(false)
        }
        fetchSubtopics()
    }, [selectedTopics])

    const toggleStudent = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        )
    }

    const toggleAllStudents = () => {
        if (selectedStudentIds.length === allStudents.length) {
            setSelectedStudentIds([])
        } else {
            setSelectedStudentIds(allStudents.map(s => s.id))
        }
    }

    const toggleAllTopics = () => {
        if (selectedTopics.length === topics.length) {
            setSelectedTopics([])
        } else {
            setSelectedTopics(topics.map(t => t.id))
        }
    }

    const toggleTopic = (id: string) => {
        setSelectedTopics(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        )
    }

    const toggleSubtopic = (id: string) => {
        setSelectedSubtopics(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        )
    }

    const handleStartGame = () => {
        if (!selectedClass || !selectedSubject || !questionSource) {
            alert("Please complete all selections")
            return
        }
        if (selectedStudentIds.length === 0) {
            alert("Please select at least one student")
            return
        }
        if (questionSource === 'ai' && !aiModel) {
            alert("Please select an AI model")
            return
        }
        if (selectedQuestionTypes.length === 0) {
            alert("Please select at least one question type")
            return
        }

        // Code already verified by layout, proceed to game
        navigateToGame()
    }

    const navigateToGame = () => {
        const params = new URLSearchParams({
            teacherId: selectedTeacher || 'guest',
            classId: selectedClass,
            studentIds: selectedStudentIds.join(','),
            subjectId: selectedSubject,
            topicIds: selectedTopics.join(','),
            subtopicIds: selectedSubtopics.join(','),
            questionTypes: selectedQuestionTypes.join(','),
            source: questionSource,
            tabs: numTabs.toString(),
            ...(aiModel && { model: aiModel })
        })
        router.push(`/game/play?${params.toString()}`)
    }

    const canProceed = () => {
        switch (step) {
            case 1: return selectedTeacher !== ''
            case 2: return selectedClass !== ''
            case 3: return selectedStudentIds.length > 0
            case 4: return selectedSubject !== ''
            case 5: return selectedTopics.length > 0
            case 6: return true // Subtopics are optional
            case 7: return selectedQuestionTypes.length > 0
            case 8: return questionSource === 'bank' || (questionSource === 'ai' && aiModel !== '')
            default: return false
        }
    }

    const nextStep = () => {
        if (canProceed() && step < 8) setStep(step + 1)
    }

    const prevStep = () => {
        if (step > 1) setStep(step - 1)
    }

    const resetSelection = () => {
        setStep(1)
        setSelectedTeacher('')
        setSelectedClass('')
        setSelectedStudentIds([])
        setSelectedSubject('')
        setSelectedTopics([])
        setSelectedSubtopics([])
        setSelectedQuestionTypes(['mcq', 'integer', 'subjective'])
        setQuestionSource('')
        setAiModel('')
        setNumTabs(1)
    }

    // Loading spinner component
    const LoadingSpinner = ({ text }: { text: string }) => (
        <div className="text-center py-12 text-white/60">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-400" />
            <p>{text}</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white overflow-hidden relative">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIiBkPSJNMCAwaDYwdjYwSDB6Ii8+PHBhdGggZD0iTTYwIDBIMHY2MCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-50"></div>
            </div>

            {/* Header */}
            <div className="relative z-10">
                <div className="container mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition group">
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span>Back to Home</span>
                        </Link>
                        <button onClick={resetSelection} className="flex items-center gap-2 text-white/60 hover:text-white transition">
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 container mx-auto px-6 py-8">
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-4">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">Configure Your Quiz</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-pink-200">
                        Game Setup
                    </h1>
                    <p className="text-white/60 mt-2 max-w-lg mx-auto">
                        Select your class, subject, and topics to begin the quiz adventure
                    </p>
                </motion.div>

                {/* Resume Saved Game Section */}
                {savedGames.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <button
                            onClick={() => setShowSavedGames(!showSavedGames)}
                            className="w-full flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl px-6 py-4 hover:border-emerald-500/50 transition group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <Pause className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold text-white">Resume Saved Game</p>
                                    <p className="text-sm text-white/60">{savedGames.length} paused game{savedGames.length > 1 ? 's' : ''} available</p>
                                </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-white/60 transition-transform ${showSavedGames ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showSavedGames && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 space-y-3">
                                        {savedGames.map((game) => (
                                            <div
                                                key={game.id}
                                                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition"
                                            >
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-white">{game.name || 'Untitled Game'}</h4>
                                                    <div className="flex flex-col gap-1 mt-1 text-sm text-white/50">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-3 h-3 text-cyan-400" />
                                                            <span className="text-white/70">{(() => { const c = game.classes ? (Array.isArray(game.classes) ? game.classes[0] : game.classes) : null; return c ? `${c.name} (${c.section})` : 'Unknown Class'; })()}</span>
                                                            <span className="text-white/20">|</span>
                                                            <BookOpen className="w-3 h-3 text-purple-400" />
                                                            <span className="text-white/70">{(() => { const s = game.subjects ? (Array.isArray(game.subjects) ? game.subjects[0] : game.subjects) : null; return s ? s.name : 'Unknown Subject'; })()}</span>
                                                        </div>

                                                        {game.topic_ids && game.topic_ids.length > 0 && (
                                                            <div className="flex items-start gap-2">
                                                                <Layers className="w-3 h-3 text-yellow-400 mt-1" />
                                                                <span className="text-white/60 line-clamp-1">
                                                                    {game.topic_ids.map(id => topicNamesMap[id]).filter(Boolean).join(', ')}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-3 mt-1 text-xs">
                                                            <span className="flex items-center gap-1 text-white/40">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(game.started_at).toLocaleDateString()}
                                                            </span>
                                                            <span className="text-green-400 flex items-center gap-1">
                                                                <Trophy className="w-3 h-3" /> {game.game_score} pts
                                                            </span>
                                                            <span className="text-cyan-400 flex items-center gap-1">
                                                                <Database className="w-3 h-3" /> {game.num_tabs} panel{game.num_tabs > 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            await supabase.from('game_sessions').delete().eq('id', game.id)
                                                            setSavedGames(prev => prev.filter(g => g.id !== game.id))
                                                        }}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400"
                                                        title="Delete saved game"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/game/play?resume=${game.id}&tabs=${game.num_tabs || 1}`)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                        Resume
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* Progress Steps */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full p-2 overflow-x-auto">
                        {[
                            { num: 1, label: 'Teacher', icon: UserCheck },
                            { num: 2, label: 'Class', icon: Users },
                            { num: 3, label: 'Students', icon: UserPlus },
                            { num: 4, label: 'Subject', icon: BookOpen },
                            { num: 5, label: 'Topics', icon: Layers },
                            { num: 6, label: 'Subtopics', icon: FileText },
                            { num: 7, label: 'Types', icon: CheckSquare },
                            { num: 8, label: 'Source', icon: Brain },
                        ].map((s, i) => (
                            <div key={s.num} className="flex items-center">
                                <button
                                    onClick={() => s.num < step ? setStep(s.num) : null}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${step === s.num
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                                        : step > s.num
                                            ? 'bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30'
                                            : 'text-white/40'
                                        }`}
                                >
                                    <s.icon className="w-4 h-4" />
                                    <span className="hidden md:inline text-sm font-medium">{s.label}</span>
                                </button>
                                {i < 7 && <ChevronRight className={`w-4 h-4 mx-1 ${step > s.num ? 'text-green-400' : 'text-white/20'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="max-w-4xl mx-auto">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Teacher Selection */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-8">Who is conducting this quiz?</h2>

                                {loadingTeachers ? (
                                    <LoadingSpinner text="Loading teachers..." />
                                ) : teachers.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                    >
                                        {teachers.map(teacher => (
                                            <motion.button
                                                key={teacher.id}
                                                variants={itemVariants}
                                                onClick={() => setSelectedTeacher(teacher.id)}
                                                className={`p-6 rounded-2xl border-2 transition-all transform hover:scale-105 ${selectedTeacher === teacher.id
                                                    ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-indigo-400 shadow-lg shadow-indigo-500/20'
                                                    : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                                                    }`}
                                            >
                                                <UserCheck className={`w-8 h-8 mb-3 ${selectedTeacher === teacher.id ? 'text-indigo-400' : 'text-white/60'}`} />
                                                <h3 className="text-xl font-bold">{teacher.full_name || 'Teacher'}</h3>
                                                <p className="text-white/60 text-sm">{teacher.email}</p>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-12 text-white/60 bg-white/5 rounded-2xl border border-white/10">
                                        <UserCheck className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                                        <p className="text-lg font-medium mb-2">No teachers found</p>
                                        <p className="text-sm">Add teachers via the Admin panel first.</p>
                                        <Link href="/admin/teachers" className="inline-block mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                                            Go to Admin Panel
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 2: Class Selection */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-8">Select Class</h2>

                                {loadingClasses ? (
                                    <LoadingSpinner text="Loading classes..." />
                                ) : classes.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                    >
                                        {classes.map(cls => (
                                            <motion.button
                                                key={cls.id}
                                                variants={itemVariants}
                                                onClick={() => setSelectedClass(cls.id)}
                                                className={`p-6 rounded-2xl border-2 transition-all transform hover:scale-105 ${selectedClass === cls.id
                                                    ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-indigo-400 shadow-lg shadow-indigo-500/20'
                                                    : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                                                    }`}
                                            >
                                                <Users className={`w-8 h-8 mb-3 ${selectedClass === cls.id ? 'text-indigo-400' : 'text-white/60'}`} />
                                                <h3 className="text-xl font-bold">{cls.name}</h3>
                                                <p className="text-white/60 text-sm">Section {cls.section}</p>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-12 text-white/60 bg-white/5 rounded-2xl border border-white/10">
                                        <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                                        <p className="text-lg font-medium mb-2">No classes found</p>
                                        <p className="text-sm">Run the seed SQL in Supabase or add classes via Admin panel.</p>
                                        <Link href="/admin/classes" className="inline-block mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                                            Add Classes
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 3: Student Selection */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-2">Select Students</h2>
                                <p className="text-center text-white/60 mb-8">Choose which students will participate in this quiz</p>

                                {loadingStudents ? (
                                    <LoadingSpinner text="Loading students..." />
                                ) : allStudents.length > 0 ? (
                                    <>
                                        {/* Select All / Deselect All */}
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-white/70 text-sm">
                                                {selectedStudentIds.length} of {allStudents.length} students selected
                                            </p>
                                            <button
                                                onClick={toggleAllStudents}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                                                    selectedStudentIds.length === allStudents.length
                                                        ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                                                        : 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                                                }`}
                                            >
                                                <CheckSquare className="w-4 h-4" />
                                                {selectedStudentIds.length === allStudents.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>

                                        <motion.div
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="visible"
                                            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
                                        >
                                            {allStudents.map(student => (
                                                <motion.button
                                                    key={student.id}
                                                    variants={itemVariants}
                                                    onClick={() => toggleStudent(student.id)}
                                                    className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedStudentIds.includes(student.id)
                                                        ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400'
                                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                                    }`}
                                                >
                                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${selectedStudentIds.includes(student.id) ? 'bg-green-500 border-green-500' : 'border-white/30'
                                                    }`}>
                                                        {selectedStudentIds.includes(student.id) && <span className="text-white text-sm">✓</span>}
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                                        {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                    </div>
                                                    <span className="font-medium text-sm truncate">{student.full_name}</span>
                                                </motion.button>
                                            ))}
                                        </motion.div>
                                    </>
                                ) : (
                                    <div className="text-center py-12 text-white/60 bg-white/5 rounded-2xl border border-white/10">
                                        <Users className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                                        <p className="text-lg font-medium mb-2">No students found for this class</p>
                                        <p className="text-sm">Add students via the Admin panel first.</p>
                                        <Link href="/admin/students" className="inline-block mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                                            Add Students
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 4: Subject Selection */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-8">Select Subject</h2>

                                {loadingSubjects ? (
                                    <LoadingSpinner text="Loading subjects..." />
                                ) : subjects.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                    >
                                        {subjects.map(subj => (
                                            <motion.button
                                                key={subj.id}
                                                variants={itemVariants}
                                                onClick={() => setSelectedSubject(subj.id)}
                                                className={`p-6 rounded-2xl border-2 transition-all transform hover:scale-105 group ${selectedSubject === subj.id
                                                    ? 'border-indigo-400 shadow-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20'
                                                    : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                                                    }`}
                                            >
                                                <BookOpen className={`w-8 h-8 mb-3 ${selectedSubject === subj.id ? 'text-indigo-400' : 'text-white/60'}`} />
                                                <h3 className="text-xl font-bold">{subj.name}</h3>
                                                <div
                                                    className={`mt-2 h-1 rounded-full transition-all bg-indigo-500 ${selectedSubject === subj.id ? 'w-full' : 'w-0 group-hover:w-1/2'}`}
                                                ></div>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-12 text-white/60 bg-white/5 rounded-2xl border border-white/10">
                                        <BookOpen className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                                        <p className="text-lg font-medium mb-2">No subjects found for this class</p>
                                        <p className="text-sm">Add subjects via the Admin panel.</p>
                                        <Link href="/admin/subjects" className="inline-block mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                                            Add Subjects
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 5: Topics Selection (Multi-select) */}
                        {step === 5 && (
                            <motion.div
                                key="step5"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-2">Select Topics</h2>
                                <p className="text-center text-white/60 mb-8">Select one or more topics (multi-select)</p>

                                {loadingTopics ? (
                                    <LoadingSpinner text="Loading topics..." />
                                ) : topics.length > 0 ? (
                                    <>
                                        {/* Select All / Deselect All */}
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-white/70 text-sm">
                                                {selectedTopics.length} of {topics.length} topics selected
                                            </p>
                                            <button
                                                onClick={toggleAllTopics}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                                                    selectedTopics.length === topics.length
                                                        ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                                                        : 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                                                }`}
                                            >
                                                <CheckSquare className="w-4 h-4" />
                                                {selectedTopics.length === topics.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>

                                        <motion.div
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="visible"
                                            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                                        >
                                            {topics.map(topic => (
                                                <motion.button
                                                    key={topic.id}
                                                    variants={itemVariants}
                                                    onClick={() => toggleTopic(topic.id)}
                                                    className={`p-5 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedTopics.includes(topic.id)
                                                        ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400'
                                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                                        }`}
                                                >
                                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selectedTopics.includes(topic.id) ? 'bg-green-500 border-green-500' : 'border-white/30'
                                                        }`}>
                                                        {selectedTopics.includes(topic.id) && <span className="text-white text-sm">✓</span>}
                                                    </div>
                                                    <Layers className="w-5 h-5 text-white/60" />
                                                    <span className="font-medium">{topic.name}</span>
                                                </motion.button>
                                            ))}
                                        </motion.div>
                                    </>
                                ) : (
                                    <div className="text-center py-12 text-white/60 bg-white/5 rounded-2xl border border-white/10">
                                        <Layers className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                                        <p className="text-lg font-medium mb-2">No topics found for this subject</p>
                                        <p className="text-sm">Add topics via the Admin panel.</p>
                                        <Link href="/admin/subjects" className="inline-block mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                                            Add Topics
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 6: Subtopics Selection (Optional Multi-select) */}
                        {step === 6 && (
                            <motion.div
                                key="step6"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-2">Select Subtopics (Optional)</h2>
                                <p className="text-center text-white/60 mb-8">Leave empty to include all subtopics</p>

                                {loadingSubtopics ? (
                                    <LoadingSpinner text="Loading subtopics..." />
                                ) : subtopics.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                                    >
                                        {subtopics.map(sub => (
                                            <motion.button
                                                key={sub.id}
                                                variants={itemVariants}
                                                onClick={() => toggleSubtopic(sub.id)}
                                                className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${selectedSubtopics.includes(sub.id)
                                                    ? 'bg-purple-500/20 border-purple-400'
                                                    : 'bg-white/5 border-white/10 hover:border-white/30'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedSubtopics.includes(sub.id) ? 'bg-purple-500 border-purple-500' : 'border-white/30'
                                                    }`}>
                                                    {selectedSubtopics.includes(sub.id) && <span className="text-white text-xs">✓</span>}
                                                </div>
                                                <span className="text-sm">{sub.name}</span>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-8 text-white/60 bg-white/5 rounded-xl border border-white/10">
                                        <FileText className="w-8 h-8 mx-auto mb-2 text-white/40" />
                                        <p>No subtopics available. Proceeding will use all questions from selected topics.</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 7: Question Type Selection (Multi-select) */}
                        {step === 7 && (
                            <motion.div
                                key="step7"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-2">Select Question Types</h2>
                                <p className="text-center text-white/60 mb-8">Choose which types of questions to include</p>

                                <motion.div
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto"
                                >
                                    {[
                                        { id: 'mcq', name: 'Multiple Choice', icon: '🔘', description: 'Choose from options' },
                                        { id: 'integer', name: 'Numeric Answer', icon: '🔢', description: 'Enter a number' },
                                        { id: 'subjective', name: 'Subjective', icon: '✍️', description: 'Text-based answer' }
                                    ].map(type => (
                                        <motion.button
                                            key={type.id}
                                            variants={itemVariants}
                                            onClick={() => {
                                                if (selectedQuestionTypes.includes(type.id)) {
                                                    setSelectedQuestionTypes(selectedQuestionTypes.filter(t => t !== type.id))
                                                } else {
                                                    setSelectedQuestionTypes([...selectedQuestionTypes, type.id])
                                                }
                                            }}
                                            className={`p-5 rounded-2xl border-2 transition-all text-center ${selectedQuestionTypes.includes(type.id)
                                                ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-cyan-400 shadow-lg'
                                                : 'bg-white/5 border-white/10 hover:border-cyan-400/50 hover:bg-cyan-500/10'
                                                }`}
                                        >
                                            <div className="text-3xl mb-2">{type.icon}</div>
                                            <h3 className="font-bold mb-1">{type.name}</h3>
                                            <p className="text-white/60 text-xs">{type.description}</p>
                                            {selectedQuestionTypes.includes(type.id) && (
                                                <div className="mt-2 text-cyan-400 text-sm font-medium">✓ Selected</div>
                                            )}
                                        </motion.button>
                                    ))}
                                </motion.div>

                                {selectedQuestionTypes.length === 0 && (
                                    <p className="text-center text-yellow-400 text-sm">Please select at least one question type</p>
                                )}
                            </motion.div>
                        )}

                        {/* Step 8: Question Source Selection */}
                        {step === 8 && (
                            <motion.div
                                key="step8"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-2">Select Question Source</h2>
                                <p className="text-center text-white/60 mb-8">Choose where to get questions from</p>

                                <motion.div
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto"
                                >
                                    {/* AI Generation Option */}
                                    <motion.button
                                        variants={itemVariants}
                                        onClick={() => {
                                            setQuestionSource('ai')
                                            if (!aiModel) setAiModel('gemini') // Default to Gemini
                                        }}
                                        className={`p-6 rounded-2xl border-2 transition-all text-left ${questionSource === 'ai'
                                            ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border-purple-400 shadow-lg shadow-purple-500/20'
                                            : 'bg-white/5 border-white/10 hover:border-purple-400/50 hover:bg-purple-500/10'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl mb-3 flex items-center justify-center ${questionSource === 'ai'
                                            ? 'bg-purple-500'
                                            : 'bg-purple-500/20'
                                            }`}>
                                            <Brain className={`w-6 h-6 ${questionSource === 'ai' ? 'text-white' : 'text-purple-400'}`} />
                                        </div>
                                        <h3 className="text-lg font-bold mb-1">Generate with AI</h3>
                                        <p className="text-white/60 text-sm">
                                            AI creates unique questions based on your selection.
                                        </p>
                                    </motion.button>

                                    {/* Question Bank Option */}
                                    <motion.button
                                        variants={itemVariants}
                                        onClick={() => {
                                            setQuestionSource('bank')
                                            setAiModel('')
                                        }}
                                        className={`p-6 rounded-2xl border-2 transition-all text-left ${questionSource === 'bank'
                                            ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border-emerald-400 shadow-lg shadow-emerald-500/20'
                                            : 'bg-white/5 border-white/10 hover:border-emerald-400/50 hover:bg-emerald-500/10'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl mb-3 flex items-center justify-center ${questionSource === 'bank'
                                            ? 'bg-emerald-500'
                                            : 'bg-emerald-500/20'
                                            }`}>
                                            <Database className={`w-6 h-6 ${questionSource === 'bank' ? 'text-white' : 'text-emerald-400'}`} />
                                        </div>
                                        <h3 className="text-lg font-bold mb-1">From Question Bank</h3>
                                        <p className="text-white/60 text-sm">
                                            Use pre-created questions from database.
                                        </p>
                                    </motion.button>
                                </motion.div>

                                {/* AI Model Selection - Show when AI is selected */}
                                {questionSource === 'ai' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-8 max-w-xl mx-auto"
                                    >
                                        <h3 className="text-lg font-semibold text-center mb-4 text-purple-300">Select AI Model</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                            {[
                                                { id: 'gemini', name: 'Gemini', color: 'from-blue-500 to-cyan-500' },
                                                { id: 'openai', name: 'OpenAI', color: 'from-green-500 to-emerald-500' },
                                                { id: 'claude', name: 'Claude', color: 'from-orange-500 to-amber-500' },
                                                { id: 'deepseek', name: 'DeepSeek', color: 'from-indigo-500 to-violet-500' },
                                                { id: 'grok', name: 'Grok', color: 'from-red-500 to-pink-500' },
                                            ].map((model) => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => setAiModel(model.id as typeof aiModel)}
                                                    className={`p-3 rounded-xl border-2 transition-all font-medium text-sm ${aiModel === model.id
                                                        ? `bg-gradient-to-r ${model.color} border-white/30 text-white shadow-lg`
                                                        : 'bg-white/5 border-white/10 hover:border-white/30 text-white/70 hover:text-white'
                                                        }`}
                                                >
                                                    {model.name}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-center text-white/40 text-xs mt-3">
                                            Make sure the corresponding API key is configured in .env.local
                                        </p>
                                    </motion.div>
                                )}

                                {/* Parallel Students (Tabs) Selection */}
                                {questionSource && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-8 max-w-md mx-auto"
                                    >
                                        <h3 className="text-lg font-semibold text-center mb-4 text-cyan-300">
                                            Parallel Students (Optional)
                                        </h3>
                                        <p className="text-center text-white/60 text-sm mb-4">
                                            Play with multiple students simultaneously
                                        </p>
                                        <div className="flex items-center justify-center gap-4">
                                            <button
                                                onClick={() => setNumTabs(Math.max(1, numTabs - 1))}
                                                className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition text-xl font-bold"
                                            >
                                                −
                                            </button>
                                            <div className="px-8 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-400/30">
                                                <span className="text-3xl font-bold text-cyan-300">{numTabs}</span>
                                                <span className="text-white/60 ml-2">student{numTabs > 1 ? 's' : ''}</span>
                                            </div>
                                            <button
                                                onClick={() => setNumTabs(numTabs + 1)}
                                                className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition text-xl font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                        {numTabs > 1 && (
                                            <p className="text-center text-cyan-400/60 text-xs mt-3">
                                                💡 Use "Spin All" to spin all wheels at once
                                            </p>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="mt-12 flex justify-between items-center">
                        <button
                            onClick={prevStep}
                            disabled={step === 1}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Previous
                        </button>

                        {step < 8 ? (
                            <button
                                onClick={nextStep}
                                disabled={!canProceed()}
                                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition shadow-lg shadow-indigo-500/25 disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                            >
                                Next
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleStartGame}
                                disabled={!canProceed()}
                                className="flex items-center gap-3 px-10 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition shadow-lg shadow-green-500/25 font-bold text-lg transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Play className="w-6 h-6 fill-current" />
                                Start Quiz!
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
