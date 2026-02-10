'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { SpinningWheel } from '@/components/game/SpinningWheel'
import { Blackboard } from '@/components/game/Blackboard'
import { InlineBlackboard } from '@/components/game/InlineBlackboard'
import { FloatingStudents } from '@/components/game/FloatingStudents'
import { MathRenderer } from '@/components/ui/MathRenderer'
import { Trophy, Star, CheckCircle, XCircle, ArrowRight, Home, Sparkles, Zap, Clock, Loader2, Brain, Wand2, PenTool, RefreshCw, AlertTriangle, Save, X, SkipForward } from 'lucide-react'
import Link from 'next/link'

type Student = { id: string; full_name: string }
type Question = {
    id: string
    content: string
    type: string
    options: string[] | null
    correct_answer: string
    points: number
    difficulty: string
    solution_text?: string | null
    solution_image_url?: string | null
}

const QUESTION_TIME_LIMIT = 120 // 2 minutes in seconds

export default function PlayGamePage() {
    const searchParams = useSearchParams()
    const teacherId = searchParams.get('teacherId')
    const classId = searchParams.get('classId')
    const subjectId = searchParams.get('subjectId')
    const topicIds = searchParams.get('topicIds')?.split(',').filter(Boolean) || []
    const subtopicIds = searchParams.get('subtopicIds')?.split(',').filter(Boolean) || []
    const questionTypes = searchParams.get('questionTypes')?.split(',').filter(Boolean) || ['mcq', 'integer', 'subjective']
    const questionSource = searchParams.get('source') as 'ai' | 'bank' | null
    const aiModel = searchParams.get('model') as 'gemini' | 'openai' | 'claude' | 'deepseek' | 'grok' | null
    const numTabs = parseInt(searchParams.get('tabs') || '1', 10)
    const resumeSessionId = searchParams.get('resume') // Optional: ID of paused game to resume

    // Multi-tab state - each panel is fully independent
    type TabState = {
        id: number
        phase: 'wheel' | 'announcement' | 'question' | 'result'
        selectedStudent: Student | null
        currentQuestion: Question | null
        selectedAnswer: string | null
        isCorrect: boolean | null
        awaitingTeacherScore: boolean
        teacherAwardedPoints: number | null
        timeLeft: number
        showBlackboard: boolean  // Each panel has its own blackboard
        skippedQuestions: string[] // Track skipped questions per panel
    }

    const [tabs, setTabs] = useState<TabState[]>([])
    const [activeTabIndex, setActiveTabIndex] = useState(0)
    const [autoSpinPanels, setAutoSpinPanels] = useState<boolean[]>([]) // Track which panels should auto-spin
    const [panelSpinning, setPanelSpinning] = useState<boolean[]>([]) // Track spinning state for each panel

    const [students, setStudents] = useState<Student[]>([])
    const [availableStudents, setAvailableStudents] = useState<Student[]>([])
    const [questions, setQuestions] = useState<Question[]>([])
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [spinning, setSpinning] = useState(false)
    const [gamePhase, setGamePhase] = useState<'loading' | 'wheel' | 'question' | 'result' | 'no-questions'>('loading')
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [score, setScore] = useState(0)
    const [round, setRound] = useState(1)
    const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([])
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
    const [isAIQuestion, setIsAIQuestion] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState('Initializing game...')
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [showBlackboard, setShowBlackboard] = useState(false)

    // Teacher scoring for integer/subjective questions
    const [awaitingTeacherScore, setAwaitingTeacherScore] = useState(false)
    const [teacherAwardedPoints, setTeacherAwardedPoints] = useState<number | null>(null)
    const [studentTotalPoints, setStudentTotalPoints] = useState(0) // From database

    // Context info for AI - stored for retry functionality
    const [subjectName, setSubjectName] = useState('')
    const [topicNames, setTopicNames] = useState<string[]>([])
    const [subtopicNames, setSubtopicNames] = useState<string[]>([])

    // Timer state
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Game session for persistence
    const [sessionId, setSessionId] = useState<string | null>(null)

    // Save game modal state
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [gameName, setGameName] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const supabase = createClient()

    // Initialize game - fetch all required data
    useEffect(() => {
        const initGame = async () => {
            if (!classId) return
            setGamePhase('loading')
            setLoadingProgress(0)

            try {
                // Step 1: Fetch students
                setLoadingMessage('Loading students...')
                setLoadingProgress(10)
                const { data: studentsData } = await supabase
                    .from('students')
                    .select('id, full_name')
                    .eq('class_id', classId)
                if (studentsData) {
                    setStudents(studentsData)
                    setAvailableStudents(studentsData)
                }

                // Step 2: Get subject name for AI context
                setLoadingMessage('Loading subject info...')
                setLoadingProgress(25)
                if (subjectId) {
                    const { data: subjectData } = await supabase
                        .from('subjects')
                        .select('name')
                        .eq('id', subjectId)
                        .single()
                    if (subjectData) setSubjectName(subjectData.name)
                }

                // Step 3: Get topic names for AI context
                setLoadingMessage('Loading topics...')
                setLoadingProgress(40)
                if (topicIds.length > 0) {
                    const { data: topicsData } = await supabase
                        .from('topics')
                        .select('name')
                        .in('id', topicIds)
                    if (topicsData) setTopicNames(topicsData.map(t => t.name))
                }

                // Step 4: Create game session
                setLoadingMessage('Creating game session...')
                setLoadingProgress(50)
                const { data: sessionData } = await supabase
                    .from('game_sessions')
                    .insert({
                        teacher_id: teacherId !== 'guest' ? teacherId : null,
                        class_id: classId,
                        subject_id: subjectId,
                        topic_ids: topicIds,
                        subtopic_ids: subtopicIds,
                        status: 'active'
                    })
                    .select('id')
                    .single()
                if (sessionData) setSessionId(sessionData.id)

                // Step 5: Handle questions based on source selection
                if (questionSource === 'ai') {
                    // AI generation only - pass subject/topic names directly
                    setLoadingMessage('Generating questions with AI...')
                    setLoadingProgress(70)

                    // Fetch subject name
                    let fetchedSubjectName = 'General Knowledge'
                    if (subjectId) {
                        const { data: subjectData } = await supabase
                            .from('subjects')
                            .select('name')
                            .eq('id', subjectId)
                            .single()
                        if (subjectData) fetchedSubjectName = subjectData.name
                    }

                    // Fetch topic names
                    let fetchedTopicNames: string[] = []
                    if (topicIds.length > 0) {
                        const { data: topicsData } = await supabase
                            .from('topics')
                            .select('name')
                            .in('id', topicIds)
                        if (topicsData) fetchedTopicNames = topicsData.map(t => t.name)
                    }

                    // Also get subtopic names
                    let fetchedSubtopicNames: string[] = []
                    if (subtopicIds.length > 0) {
                        const { data: subtopicsData } = await supabase
                            .from('subtopics')
                            .select('name')
                            .in('id', subtopicIds)
                        if (subtopicsData) fetchedSubtopicNames = subtopicsData.map(s => s.name)
                    }

                    console.log('AI Generation Context:', {
                        subject: fetchedSubjectName,
                        topics: fetchedTopicNames,
                        subtopics: fetchedSubtopicNames,
                        model: aiModel
                    })

                    // Save to state for retry functionality
                    setSubjectName(fetchedSubjectName)
                    setTopicNames(fetchedTopicNames)
                    setSubtopicNames(fetchedSubtopicNames)

                    await generateQuestionsWithAI(fetchedSubjectName, fetchedTopicNames, fetchedSubtopicNames)
                } else {
                    // Question Bank only
                    setLoadingMessage('Searching for questions in database...')
                    setLoadingProgress(60)

                    let allQuestions: Question[] = []

                    // Method 1: Fetch questions by subtopic/topic (legacy method)
                    let questionsQuery = supabase.from('questions').select('*')

                    // Filter by subtopics if selected
                    if (subtopicIds.length > 0) {
                        questionsQuery = questionsQuery.in('subtopic_id', subtopicIds)
                    } else if (topicIds.length > 0) {
                        // Get subtopics for these topics and filter
                        const { data: subtopicsData } = await supabase
                            .from('subtopics')
                            .select('id')
                            .in('topic_id', topicIds)
                        if (subtopicsData && subtopicsData.length > 0) {
                            questionsQuery = questionsQuery.in('subtopic_id', subtopicsData.map(s => s.id))
                        }
                    }

                    // Filter by question types
                    if (questionTypes.length > 0) {
                        questionsQuery = questionsQuery.in('type', questionTypes)
                    }

                    const { data: questionsData } = await questionsQuery.limit(20)
                    if (questionsData) allQuestions = [...questionsData]

                    // Method 2: Fetch questions linked to this class via question_class_links
                    setLoadingProgress(75)
                    setLoadingMessage('Searching class-linked questions...')

                    const { data: linkedQuestionIds } = await supabase
                        .from('question_class_links')
                        .select('question_id')
                        .eq('class_id', classId)

                    if (linkedQuestionIds && linkedQuestionIds.length > 0) {
                        let linkedQuery = supabase
                            .from('questions')
                            .select('*')
                            .in('id', linkedQuestionIds.map(l => l.question_id))

                        // CRITICAL: Also filter by subtopic/topic to ensure correct subject
                        if (subtopicIds.length > 0) {
                            linkedQuery = linkedQuery.in('subtopic_id', subtopicIds)
                        } else if (topicIds.length > 0) {
                            // Get subtopics for these topics and filter
                            const { data: topicSubtopics } = await supabase
                                .from('subtopics')
                                .select('id')
                                .in('topic_id', topicIds)
                            if (topicSubtopics && topicSubtopics.length > 0) {
                                linkedQuery = linkedQuery.in('subtopic_id', topicSubtopics.map(s => s.id))
                            }
                        }

                        // Also filter by question types if selected
                        if (questionTypes.length > 0) {
                            linkedQuery = linkedQuery.in('type', questionTypes)
                        }

                        const { data: linkedQuestionsData } = await linkedQuery.limit(20)

                        if (linkedQuestionsData) {
                            // Merge and deduplicate
                            const existingIds = new Set(allQuestions.map(q => q.id))
                            linkedQuestionsData.forEach(q => {
                                if (!existingIds.has(q.id)) {
                                    allQuestions.push(q)
                                }
                            })
                        }
                    }

                    if (allQuestions.length > 0) {
                        setLoadingProgress(100)
                        setLoadingMessage('Ready to play!')
                        // Debug: log question types loaded
                        const typeCounts = allQuestions.reduce((acc, q) => { acc[q.type] = (acc[q.type] || 0) + 1; return acc }, {} as Record<string, number>)
                        console.log('Questions loaded from bank:', { total: allQuestions.length, types: typeCounts, questions: allQuestions.map(q => ({ id: q.id, type: q.type, content: q.content.substring(0, 50) })) })
                        // Shuffle and limit
                        const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 50)
                        setQuestions(shuffled)
                        setTimeout(() => setGamePhase('wheel'), 500)
                    } else {
                        // No questions in database for selected criteria
                        setLoadingMessage('No questions found in the Question Bank for your selection.')
                        setGamePhase('no-questions')
                    }
                }

            } catch (error) {
                console.error('Init game error:', error)
                setLoadingMessage('Error loading game data.')
                setGamePhase('no-questions')
            }
        }

        initGame()
    }, [classId, subjectId])

    // Handle resuming a saved/paused game
    useEffect(() => {
        if (!resumeSessionId) return

        const resumeGame = async () => {
            setLoadingMessage('Resuming saved game...')
            setGamePhase('loading')
            setLoadingProgress(10)

            // Fetch the saved session with all details
            const { data: session, error } = await supabase
                .from('game_sessions')
                .select('*')
                .eq('id', resumeSessionId)
                .single()

            if (!session || error) {
                console.error('Session not found:', error)
                setLoadingMessage('Error: Game session not found')
                return
            }

            console.log('Resuming session:', session)
            setLoadingProgress(20)

            // Fetch students from the session's class
            setLoadingMessage('Loading students...')
            const { data: studentsData } = await supabase
                .from('students')
                .select('id, full_name')
                .eq('class_id', session.class_id)

            if (!studentsData || studentsData.length === 0) {
                setLoadingMessage('Error: No students found')
                return
            }

            // Filter out already-played students
            const usedIds = session.used_student_ids || []
            const remainingStudents = studentsData.filter(s => !usedIds.includes(s.id))

            setStudents(studentsData)
            setAvailableStudents(remainingStudents)
            setLoadingProgress(40)

            // Fetch questions from topics
            setLoadingMessage('Loading questions...')
            const topicIds = session.topic_ids || []
            const subtopicIds = session.subtopic_ids || []

            let questionsData: Question[] = []

            if (subtopicIds.length > 0) {
                const { data: qs } = await supabase
                    .from('questions')
                    .select('*')
                    .in('subtopic_id', subtopicIds)
                if (qs) questionsData = qs
            } else if (topicIds.length > 0) {
                const { data: subtopicsData } = await supabase
                    .from('subtopics')
                    .select('id')
                    .in('topic_id', topicIds)
                if (subtopicsData) {
                    const subIds = subtopicsData.map(s => s.id)
                    if (subIds.length > 0) {
                        const { data: qs } = await supabase
                            .from('questions')
                            .select('*')
                            .in('subtopic_id', subIds)
                        if (qs) questionsData = qs
                    }
                }
            }

            // Filter out already-answered questions
            const usedQIds = session.used_question_ids || []
            const remainingQuestions = questionsData.filter(q => !usedQIds.includes(q.id))

            setQuestions(remainingQuestions)
            setLoadingProgress(80)

            // Restore game state
            setSessionId(session.id)
            setScore(session.game_score || 0)
            setSelectedStudentIds(usedIds)
            setAnsweredQuestions(usedQIds)

            // Check for full game state snapshot and restore if present
            if (session.game_state) {
                const gs = session.game_state
                console.log('Restoring full game state:', gs)

                // Restore tabs with all panel states (students, questions, timers, phases)
                if (gs.tabs && gs.tabs.length > 0) {
                    setTabs(gs.tabs.map((t: TabState) => ({
                        id: t.id,
                        phase: t.phase || 'wheel',
                        selectedStudent: t.selectedStudent,
                        currentQuestion: t.currentQuestion,
                        selectedAnswer: t.selectedAnswer,
                        isCorrect: t.isCorrect,
                        awaitingTeacherScore: t.awaitingTeacherScore,
                        teacherAwardedPoints: t.teacherAwardedPoints,
                        timeLeft: t.timeLeft || QUESTION_TIME_LIMIT,
                        showBlackboard: t.showBlackboard || false,
                        skippedQuestions: t.skippedQuestions || []
                    })))
                    setPanelSpinning(Array(gs.tabs.length).fill(false))
                }

                // Restore questions and students from snapshot for consistency
                if (gs.questions) setQuestions(gs.questions)
                if (gs.students) setStudents(gs.students)
                if (gs.availableStudents) setAvailableStudents(gs.availableStudents)
                if (gs.round) setRound(gs.round)

                // Determine the phase to enter based on saved state
                const savedPhase = gs.gamePhase || 'wheel'
                setLoadingProgress(100)
                console.log('✓ Resumed game with full state:', session.name, '| Phase:', savedPhase)

                // Update session status to active
                await supabase
                    .from('game_sessions')
                    .update({ status: 'active' })
                    .eq('id', resumeSessionId)

                // Enter the correct phase
                setGamePhase(savedPhase === 'loading' ? 'wheel' : savedPhase)
                return
            }

            // Fallback: No game_state, use basic resume (legacy behavior)
            // Update session status to active
            await supabase
                .from('game_sessions')
                .update({ status: 'active' })
                .eq('id', resumeSessionId)

            setLoadingProgress(100)
            console.log('✓ Resumed game (basic):', session.name, '| Score:', session.game_score, '| Remaining students:', remainingStudents.length)

            // Transition to wheel phase
            setGamePhase('wheel')
        }

        resumeGame()
    }, [resumeSessionId])

    // Initialize tabs when numTabs changes and game is ready
    useEffect(() => {
        if (numTabs > 1 && gamePhase === 'wheel' && tabs.length === 0) {
            const initialTabs: TabState[] = Array.from({ length: numTabs }, (_, i) => ({
                id: i,
                phase: 'wheel',
                selectedStudent: null,
                currentQuestion: null,
                selectedAnswer: null,
                isCorrect: null,
                awaitingTeacherScore: false,
                teacherAwardedPoints: null,
                timeLeft: QUESTION_TIME_LIMIT,
                showBlackboard: false,
                skippedQuestions: []
            }))
            setTabs(initialTabs)
            // Initialize panelSpinning array for each panel
            setPanelSpinning(Array(numTabs).fill(false))
        }
    }, [numTabs, gamePhase, tabs.length])

    // Helper: Update a specific tab's state
    const updateTab = (tabIndex: number, updates: Partial<TabState>) => {
        setTabs(prev => prev.map((tab, i) =>
            i === tabIndex ? { ...tab, ...updates } : tab
        ))
    }

    // Independent timer for each panel in question phase
    useEffect(() => {
        if (numTabs <= 1 || gamePhase !== 'question') return

        const interval = setInterval(() => {
            setTabs(prev => prev.map(tab => {
                // Only tick timers for panels in question phase with pending answers
                if (tab.phase === 'question' && tab.selectedAnswer === null && tab.timeLeft > 0) {
                    const newTime = tab.timeLeft - 1
                    if (newTime === 0) {
                        return {
                            ...tab,
                            timeLeft: 0,
                            selectedAnswer: 'TIMEOUT',
                            isCorrect: false,
                            phase: 'result'
                        }
                    }
                    return { ...tab, timeLeft: newTime }
                }
                return tab
            }))
        }, 1000)

        return () => clearInterval(interval)
    }, [numTabs, gamePhase])

    // Handle answer submission for a specific panel - independent flow with real-time DB updates
    const handleTabAnswer = async (tabIndex: number, answer: string) => {
        const tab = tabs[tabIndex]
        if (!tab || !tab.currentQuestion) return

        const questionType = tab.currentQuestion.type

        // For MCQ: auto-evaluate, for integer/subjective: teacher evaluates
        if (questionType === 'mcq') {
            const isAnswerCorrect = answer === tab.currentQuestion.correct_answer
            const points = isAnswerCorrect ? (tab.currentQuestion.points || 10) : 0

            // Update this tab to result phase
            updateTab(tabIndex, {
                selectedAnswer: answer,
                isCorrect: isAnswerCorrect,
                awaitingTeacherScore: false,
                phase: 'result'
            })

            // Update local game score
            if (isAnswerCorrect) {
                setScore(prev => prev + points)
            }

            // REAL-TIME: Save result to game_results table
            if (sessionId && tab.selectedStudent && tab.currentQuestion) {
                try {
                    if (!tab.currentQuestion.id.startsWith('ai-') && !tab.currentQuestion.id.startsWith('fallback')) {
                        await supabase.from('game_results').insert({
                            session_id: sessionId,
                            student_id: tab.selectedStudent.id,
                            question_id: tab.currentQuestion.id,
                            student_answer: answer,
                            is_correct: isAnswerCorrect,
                            points_earned: points,
                            time_taken_seconds: QUESTION_TIME_LIMIT - tab.timeLeft
                        })
                    }
                } catch (err) {
                    console.error('Error saving game result:', err)
                }
            }

            // REAL-TIME: Update student's total_points in database
            if (isAnswerCorrect && tab.selectedStudent) {
                try {
                    const { data: student } = await supabase
                        .from('students')
                        .select('total_points')
                        .eq('id', tab.selectedStudent.id)
                        .single()

                    if (student) {
                        const newTotal = (student.total_points || 0) + points
                        await supabase
                            .from('students')
                            .update({ total_points: newTotal })
                            .eq('id', tab.selectedStudent.id)

                        console.log(`✓ Updated ${tab.selectedStudent.full_name}'s points: +${points} = ${newTotal}`)
                    }
                } catch (err) {
                    console.error('Error updating student points:', err)
                }
            }
        } else {
            // Integer/Subjective: Teacher must evaluate the answer
            updateTab(tabIndex, {
                selectedAnswer: answer,
                isCorrect: null, // Will be set by teacher
                awaitingTeacherScore: true,
                teacherAwardedPoints: null,
                phase: 'result'
            })
        }
    }

    // Handle teacher awarding points for a specific panel (integer/subjective questions)
    const handleTabTeacherAwardPoints = async (tabIndex: number, points: number) => {
        const tab = tabs[tabIndex]
        if (!tab || !tab.currentQuestion || !tab.selectedStudent) return

        const isCorrect = points > 0

        // Update the tab with teacher's scoring
        updateTab(tabIndex, {
            isCorrect: isCorrect,
            teacherAwardedPoints: points,
            awaitingTeacherScore: false
        })

        // Update local game score
        if (points > 0) {
            setScore(prev => prev + points)
        }

        // REAL-TIME: Save result to game_results table
        if (sessionId) {
            try {
                if (!tab.currentQuestion.id.startsWith('ai-') && !tab.currentQuestion.id.startsWith('fallback')) {
                    await supabase.from('game_results').insert({
                        session_id: sessionId,
                        student_id: tab.selectedStudent.id,
                        question_id: tab.currentQuestion.id,
                        student_answer: tab.selectedAnswer || '',
                        is_correct: isCorrect,
                        points_earned: points,
                        time_taken_seconds: QUESTION_TIME_LIMIT - tab.timeLeft
                    })
                }
            } catch (err) {
                console.error('Error saving game result:', err)
            }
        }

        // REAL-TIME: Update student's total_points in database
        if (points > 0) {
            try {
                const { data: student } = await supabase
                    .from('students')
                    .select('total_points')
                    .eq('id', tab.selectedStudent.id)
                    .single()

                if (student) {
                    const newTotal = (student.total_points || 0) + points
                    await supabase
                        .from('students')
                        .update({ total_points: newTotal })
                        .eq('id', tab.selectedStudent.id)

                    console.log(`✓ Teacher awarded ${tab.selectedStudent.full_name}: +${points} = ${newTotal}`)
                }
            } catch (err) {
                console.error('Error updating student points:', err)
            }
        }
    }

    // Handle "Next Student" for a specific panel - shows wheel animation to select next student
    const handleTabNextStudent = (tabIndex: number) => {
        // Get available students (not used by any panel currently)
        const usedStudentIds = tabs.map(t => t.selectedStudent?.id).filter(Boolean) as string[]
        const remainingStudents = students.filter(s =>
            !selectedStudentIds.includes(s.id) && !usedStudentIds.includes(s.id)
        )

        if (remainingStudents.length === 0) {
            // No more students - show empty state in this panel
            updateTab(tabIndex, {
                phase: 'wheel',
                selectedStudent: null,
                currentQuestion: null,
                selectedAnswer: null,
                isCorrect: null,
                timeLeft: QUESTION_TIME_LIMIT,
                showBlackboard: false
            })
            return
        }

        // Set panel to wheel phase - SpinningWheel component will handle the animation
        // and call onSpinEnd when done
        updateTab(tabIndex, {
            phase: 'wheel',
            selectedStudent: null,  // Will be set by SpinningWheel onSpinEnd
            currentQuestion: null,
            selectedAnswer: null,
            isCorrect: null,
            timeLeft: QUESTION_TIME_LIMIT,
            showBlackboard: false
        })
    }

    // Helper: Get students not used in any tab
    const getAvailableStudentsForTab = (tabIndex: number) => {
        const usedInOtherTabs = tabs
            .filter((_, i) => i !== tabIndex)
            .map(t => t.selectedStudent?.id)
            .filter(Boolean) as string[]
        return availableStudents.filter(s => !usedInOtherTabs.includes(s.id))
    }

    // Helper: Get questions not used in any tab
    const getAvailableQuestionsForTab = (tabIndex: number) => {
        const usedInOtherTabs = tabs
            .filter((_, i) => i !== tabIndex)
            .map(t => t.currentQuestion?.id)
            .filter(Boolean) as string[]
        return questions.filter(q =>
            !answeredQuestions.includes(q.id) && !usedInOtherTabs.includes(q.id)
        )
    }

    // Skip Question - replaces with new question, restarts timer, tracks skipped
    const handleSkipQuestion = (panelIndex: number) => {
        const panel = tabs[panelIndex]
        if (!panel || !panel.currentQuestion) return

        const currentQId = panel.currentQuestion.id

        // Get available questions excluding skipped and answered
        const excludedIds = [...answeredQuestions, ...(panel.skippedQuestions || []), currentQId]
        const usedByOtherPanels = tabs
            .filter((_, i) => i !== panelIndex)
            .map(t => t.currentQuestion?.id)
            .filter(Boolean) as string[]

        const availableQs = questions.filter(q =>
            !excludedIds.includes(q.id) && !usedByOtherPanels.includes(q.id)
        )

        if (availableQs.length === 0) {
            // No more questions available - just reset timer
            updateTab(panelIndex, {
                timeLeft: QUESTION_TIME_LIMIT
            })
            return
        }

        // Pick random new question
        const newQuestion = availableQs[Math.floor(Math.random() * availableQs.length)]

        // Update panel: track skipped, set new question, restart timer
        updateTab(panelIndex, {
            skippedQuestions: [...panel.skippedQuestions, currentQId],
            currentQuestion: newQuestion,
            timeLeft: QUESTION_TIME_LIMIT,
            selectedAnswer: null,
            isCorrect: null
        })

        // Also track in answeredQuestions so it doesn't get picked again globally
        setAnsweredQuestions(prev => [...prev, currentQId, newQuestion.id])
    }

    // Auto-transition from announcement phase to question phase after countdown
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = []

        tabs.forEach((tab, i) => {
            if (tab.phase === 'announcement' && tab.selectedStudent && tab.currentQuestion) {
                // Auto-transition to question after 3.5 seconds
                const timer = setTimeout(() => {
                    updateTab(i, { phase: 'question' })
                }, 3500)
                timers.push(timer)
            }
        })

        return () => timers.forEach(t => clearTimeout(t))
    }, [tabs.map(t => t.phase).join(',')])

    const handleSpinAll = async () => {
        if (spinning || numTabs <= 0) return

        setSpinning(true)

        // Create empty tabs in wheel phase - SpinningWheel components will handle selection
        const actualPanels = Math.min(numTabs, availableStudents.length)
        const newTabs: TabState[] = Array.from({ length: actualPanels }, (_, i) => ({
            id: i,
            phase: 'wheel' as const,
            selectedStudent: null,  // Will be set by SpinningWheel onSpinEnd
            currentQuestion: null,  // Will be set by SpinningWheel onSpinEnd
            selectedAnswer: null,
            isCorrect: null,
            awaitingTeacherScore: false,
            teacherAwardedPoints: null,
            timeLeft: QUESTION_TIME_LIMIT,
            showBlackboard: false,
            skippedQuestions: []
        }))

        setTabs(newTabs)

        // Trigger autoSpin for all panels with staggered delays
        const autoSpinFlags = Array.from({ length: actualPanels }, () => true)
        setAutoSpinPanels(autoSpinFlags)

        // The SpinningWheel components in wheel phase will now spin and call onSpinEnd
        // to assign students. Reset spinning flag after wheels should be done.
        await new Promise(resolve => setTimeout(resolve, 4000)) // Allow time for wheel animations
        setSpinning(false)
    }

    // Generate questions with AI - receives subject/topic names as parameters or uses state
    const generateQuestionsWithAI = async (
        subject?: string,
        topics?: string[],
        subtopics?: string[]
    ) => {
        // Use passed params or fall back to state
        const finalSubject = subject || subjectName || 'General Knowledge'
        const finalTopics = topics || topicNames || []
        const finalSubtopics = subtopics || subtopicNames || []

        const topicString = finalTopics.length > 0 ? finalTopics.join(', ') : 'General'
        const subtopicString = finalSubtopics.length > 0 ? finalSubtopics.join(', ') : ''

        const generatedQuestions: Question[] = []
        // Generate questions equal to total students in the class
        const numQuestions = students.length || 5

        for (let i = 0; i < numQuestions; i++) {
            setLoadingMessage(`Generating question ${i + 1} of ${numQuestions}...`)
            setLoadingProgress(70 + (i / numQuestions) * 25)

            try {
                console.log(`Generating question ${i + 1}:`, { subject: finalSubject, topics: topicString, subtopic: subtopicString, model: aiModel })

                const res = await fetch('/api/generate-question', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject: finalSubject,
                        topic: topicString,
                        subtopic: subtopicString,
                        difficulty: ['easy', 'medium', 'hard'][i % 3],
                        model: aiModel || 'openai',
                        questionType: questionTypes[i % questionTypes.length] // Cycle through selected types
                    })
                })

                if (res.ok) {
                    const data = await res.json()
                    const q = data.question
                    if (q) {
                        generatedQuestions.push({
                            id: `ai-${Date.now()}-${i}`,
                            content: q.content || q.question || '',
                            type: q.type || 'mcq',
                            options: q.options || null,
                            correct_answer: q.correct_answer || q.answer || '',
                            points: 10,
                            difficulty: q.difficulty || 'medium'
                        })
                    }
                }
            } catch (err) {
                console.error('AI generation error:', err)
            }

            // Small delay between requests
            await new Promise(r => setTimeout(r, 500))
        }

        if (generatedQuestions.length > 0) {
            setQuestions(generatedQuestions)
            setLoadingProgress(100)
            setLoadingMessage(`Generated ${generatedQuestions.length} questions! Let's play!`)
            setTimeout(() => setGamePhase('wheel'), 1000)
        } else {
            // No questions could be generated - show error state
            setLoadingMessage('Could not generate questions. Please check API keys or add questions to the database.')
            setGamePhase('no-questions')
        }
    }

    // Timer countdown - ONLY for single-panel mode
    // Multi-panel mode has independent timers per panel (see useEffect around line 337)
    useEffect(() => {
        // Skip global timer in multi-panel mode
        if (numTabs > 1) return

        if (gamePhase === 'question' && timeLeft > 0) {
            timerRef.current = setTimeout(() => {
                setTimeLeft(prev => prev - 1)
            }, 1000)
        } else if (gamePhase === 'question' && timeLeft === 0) {
            handleTimeUp()
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [gamePhase, timeLeft, numTabs])

    const handleTimeUp = () => {
        if (currentQuestion) {
            setAnsweredQuestions(prev => [...prev, currentQuestion.id])

            // For MCQ, time's up = wrong answer
            if (currentQuestion.type === 'mcq') {
                setIsCorrect(false)
                setAwaitingTeacherScore(false)
            } else {
                // For integer/subjective, teacher still needs to score
                setIsCorrect(null)
                setAwaitingTeacherScore(true)
            }

            setGamePhase('result')
        }
    }

    const handleSpinEnd = async (winner: { id: string; name: string }) => {
        setSelectedStudent({ id: winner.id, full_name: winner.name })
        setSelectedStudentIds(prev => [...prev, winner.id])
        setAvailableStudents(prev => prev.filter(s => s.id !== winner.id))

        // Fetch student's total points from database
        const { data: studentData } = await supabase
            .from('students')
            .select('total_points')
            .eq('id', winner.id)
            .single()
        if (studentData) {
            setStudentTotalPoints(studentData.total_points || 0)
        }

        // Get available questions
        const available = questions.filter(q => !answeredQuestions.includes(q.id))

        if (available.length > 0) {
            const randomQ = available[Math.floor(Math.random() * available.length)]
            setCurrentQuestion(randomQ)
            setIsAIQuestion(randomQ.id.startsWith('ai-'))
            setTimeLeft(QUESTION_TIME_LIMIT)
            setTimeout(() => setGamePhase('question'), 1500)
        } else {
            // Generate more questions
            setGamePhase('loading')
            setLoadingMessage('Generating more questions...')
            await generateQuestionsWithAI()
        }
    }

    const handleAnswer = async (answer: string) => {
        if (!currentQuestion || !selectedStudent) return
        if (timerRef.current) clearTimeout(timerRef.current)

        setSelectedAnswer(answer)
        setTeacherAwardedPoints(null) // Reset for new question

        // For MCQ, auto-score
        if (currentQuestion.type === 'mcq') {
            const correct = answer.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase()
            setIsCorrect(correct)
            setAwaitingTeacherScore(false)

            const pointsEarned = correct ? (currentQuestion.points || 10) : 0
            if (correct) {
                setScore(prev => prev + pointsEarned)
            }

            // Save result to database (only for non-AI, non-fallback questions)
            if (sessionId && !currentQuestion.id.startsWith('fallback') && !currentQuestion.id.startsWith('ai-')) {
                await supabase.from('game_results').insert({
                    session_id: sessionId,
                    student_id: selectedStudent.id,
                    question_id: currentQuestion.id,
                    student_answer: answer,
                    is_correct: correct,
                    points_earned: pointsEarned,
                    time_taken_seconds: QUESTION_TIME_LIMIT - timeLeft
                })
            }

            // ALWAYS update student's total_points in database (for ALL question types including AI)
            if (correct) {
                const { data: student } = await supabase
                    .from('students')
                    .select('total_points')
                    .eq('id', selectedStudent.id)
                    .single()

                if (student) {
                    const newTotal = (student.total_points || 0) + pointsEarned
                    await supabase.from('students')
                        .update({ total_points: newTotal })
                        .eq('id', selectedStudent.id)
                    setStudentTotalPoints(newTotal)
                }
            }
        } else {
            // For integer/subjective - teacher must score manually
            setIsCorrect(null) // Not determined yet
            setAwaitingTeacherScore(true)
        }

        setAnsweredQuestions(prev => [...prev, currentQuestion.id])
        setGamePhase('result')
    }

    // Teacher awards points for integer/subjective questions
    const handleTeacherAwardPoints = async (points: number) => {
        if (!currentQuestion || !selectedStudent) return

        setTeacherAwardedPoints(points)
        setAwaitingTeacherScore(false)

        const isCorrectAnswer = points > 0
        setIsCorrect(isCorrectAnswer)

        // Update game score
        setScore(prev => prev + points)

        // Save result to database (only for non-AI, non-fallback questions)
        if (sessionId && !currentQuestion.id.startsWith('fallback') && !currentQuestion.id.startsWith('ai-')) {
            await supabase.from('game_results').insert({
                session_id: sessionId,
                student_id: selectedStudent.id,
                question_id: currentQuestion.id,
                student_answer: selectedAnswer || '',
                is_correct: isCorrectAnswer,
                points_earned: points,
                time_taken_seconds: QUESTION_TIME_LIMIT - timeLeft
            })
        }

        // ALWAYS update student total_points (for ALL question types including AI)
        if (points !== 0) {
            const { data: student } = await supabase
                .from('students')
                .select('total_points')
                .eq('id', selectedStudent.id)
                .single()

            if (student) {
                const newTotal = Math.max(0, (student.total_points || 0) + points)
                await supabase.from('students')
                    .update({ total_points: newTotal })
                    .eq('id', selectedStudent.id)
                setStudentTotalPoints(newTotal)
            }
        }
    }

    const nextRound = () => {
        if (availableStudents.length === 0) {
            setAvailableStudents(students)
            setSelectedStudentIds([])
        }

        setRound(prev => prev + 1)
        setSelectedStudent(null)
        setCurrentQuestion(null)
        setSelectedAnswer(null)
        setIsCorrect(null)
        setIsAIQuestion(false)
        setTimeLeft(QUESTION_TIME_LIMIT)
        setGamePhase('wheel')
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Save game session for resuming later
    const handleSaveGame = async () => {
        if (!sessionId || !gameName.trim()) {
            alert('Please enter a name for the saved game')
            return
        }

        setIsSaving(true)

        try {
            // Create complete game state snapshot for accurate resume
            const gameStateSnapshot = {
                tabs: tabs.map(t => ({
                    id: t.id,
                    phase: t.phase,
                    selectedStudent: t.selectedStudent,
                    currentQuestion: t.currentQuestion,
                    selectedAnswer: t.selectedAnswer,
                    isCorrect: t.isCorrect,
                    awaitingTeacherScore: t.awaitingTeacherScore,
                    teacherAwardedPoints: t.teacherAwardedPoints,
                    timeLeft: t.timeLeft,
                    showBlackboard: t.showBlackboard,
                    skippedQuestions: t.skippedQuestions || []
                })),
                answeredQuestions,
                selectedStudentIds,
                score,
                round,
                gamePhase,
                numTabs,
                questions: questions.map(q => ({ id: q.id, content: q.content, type: q.type, options: q.options, correct_answer: q.correct_answer, points: q.points })),
                students: students.map(s => ({ id: s.id, full_name: s.full_name })),
                availableStudents: availableStudents.map(s => ({ id: s.id, full_name: s.full_name }))
            }

            // Update the game session with complete state
            const { error } = await supabase
                .from('game_sessions')
                .update({
                    name: gameName.trim(),
                    status: 'paused',
                    used_student_ids: selectedStudentIds,
                    used_question_ids: answeredQuestions,
                    game_score: score,
                    num_tabs: numTabs,
                    game_state: gameStateSnapshot
                })
                .eq('id', sessionId)

            if (error) {
                console.error('Save game error:', error)
                alert('Failed to save game: ' + error.message)
            } else {
                alert(`Game saved as "${gameName}"! You can resume it later from the game setup page.`)
                setShowSaveModal(false)
                setGameName('')
            }
        } catch (err) {
            console.error('Save game error:', err)
            alert('Failed to save game')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden">
            {/* Background effects - lightweight for smartboard performance */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-3xl"></div>
            </div>

            {/* Header */}
            {gamePhase !== 'loading' && (
                <div className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-sm">
                    <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                        <Link href="/game" className="flex items-center gap-2 text-white/60 hover:text-white transition">
                            <Home className="w-5 h-5" />
                            <span>Exit Game</span>
                        </Link>

                        <div className="flex items-center gap-4">
                            {gamePhase === 'question' && (
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${timeLeft <= 30 ? 'bg-red-500/30 border border-red-500 animate-pulse' : 'bg-white/10'
                                    }`}>
                                    <Clock className={`w-5 h-5 ${timeLeft <= 30 ? 'text-red-400' : 'text-white'}`} />
                                    <span className={`font-mono font-bold text-lg ${timeLeft <= 30 ? 'text-red-400' : 'text-white'}`}>
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                <span className="font-medium">Round {round}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
                                <Trophy className="w-5 h-5 text-yellow-400" />
                                <span className="font-bold text-xl">{score}</span>
                                <span className="text-white/60 text-sm">game pts</span>
                            </div>
                            {selectedStudent && studentTotalPoints > 0 && (
                                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-2 rounded-full border border-purple-500/30">
                                    <Star className="w-5 h-5 text-purple-400" />
                                    <span className="font-bold text-lg">{studentTotalPoints}</span>
                                    <span className="text-white/60 text-sm">total</span>
                                </div>
                            )}

                            {/* Save Game Button */}
                            <button
                                onClick={() => setShowSaveModal(true)}
                                className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-4 py-2 rounded-full transition"
                                title="Save game for later"
                            >
                                <Save className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400 text-sm font-medium">Save</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Bar - Multi-student mode */}
            {numTabs > 1 && gamePhase !== 'loading' && (
                <div className="relative z-10 border-b border-white/10 bg-black/10 backdrop-blur-sm">
                    <div className="container mx-auto px-6 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                {Array.from({ length: numTabs }, (_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveTabIndex(i)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTabIndex === i
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${tabs[i]?.phase === 'result'
                                                ? tabs[i]?.isCorrect ? 'bg-green-400' : 'bg-red-400'
                                                : tabs[i]?.phase === 'question'
                                                    ? 'bg-yellow-400 animate-pulse'
                                                    : 'bg-white/50'
                                                }`} />
                                            Student {i + 1}
                                            {tabs[i]?.selectedStudent && (
                                                <span className="text-xs opacity-70">
                                                    ({tabs[i].selectedStudent?.full_name.split(' ')[0]})
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {gamePhase === 'wheel' && (
                                <button
                                    onClick={handleSpinAll}
                                    disabled={spinning}
                                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold text-white hover:from-purple-600 hover:to-pink-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {spinning ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Spinning...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Spin All
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="relative z-10 container mx-auto px-6 py-12">
                <AnimatePresence mode="wait">
                    {/* LOADING PHASE */}
                    {gamePhase === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center min-h-[70vh]"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                className="mb-8"
                            >
                                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-1">
                                    <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                                        <Brain className="w-10 h-10 text-purple-400" />
                                    </div>
                                </div>
                            </motion.div>

                            <div className="text-center max-w-md">
                                <h2 className="text-2xl font-bold mb-4">{loadingMessage}</h2>

                                {/* Progress bar */}
                                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${loadingProgress}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>

                                <p className="text-white/60">{loadingProgress}% complete</p>

                                {loadingMessage.includes('AI') && (
                                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-purple-400">
                                        <Wand2 className="w-4 h-4" />
                                        <span>Creating custom questions for {subjectName || 'your topic'}...</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* NO QUESTIONS PHASE */}
                    {gamePhase === 'no-questions' && (
                        <motion.div
                            key="no-questions"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
                        >
                            <div className="bg-red-500/20 border border-red-500/30 rounded-full p-6 mb-8">
                                <AlertTriangle className="w-16 h-16 text-red-400" />
                            </div>

                            <h2 className="text-3xl font-bold mb-4 text-white">No Questions Available</h2>

                            <div className="max-w-md mb-8 space-y-4">
                                <p className="text-white/70">
                                    No questions found for <span className="text-indigo-400 font-semibold">{subjectName || 'this subject'}</span>
                                    {topicNames.length > 0 && (
                                        <> with topics: <span className="text-purple-400">{topicNames.join(', ')}</span></>
                                    )}
                                </p>
                                <p className="text-white/50 text-sm">
                                    {loadingMessage}
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => {
                                        setGamePhase('loading')
                                        setLoadingProgress(70)
                                        setLoadingMessage('Retrying AI generation...')
                                        generateQuestionsWithAI()
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Retry AI Generation
                                </button>

                                <Link
                                    href="/game"
                                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                    Change Selection
                                </Link>
                            </div>

                            <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10 max-w-lg">
                                <h3 className="text-sm font-semibold text-white/80 mb-3">To add questions:</h3>
                                <ul className="text-left text-white/60 text-sm space-y-2">
                                    <li>• Add questions via the <Link href="/admin" className="text-indigo-400 underline">Admin Panel</Link></li>
                                    <li>• Configure <code className="bg-white/10 px-1 rounded">GEMINI_API_KEY</code> or <code className="bg-white/10 px-1 rounded">OPENAI_API_KEY</code> in .env.local for AI generation</li>
                                </ul>
                            </div>
                        </motion.div>
                    )}
                    {/* WHEEL PHASE */}
                    {gamePhase === 'wheel' && (
                        <motion.div
                            key="wheel"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full"
                        >
                            {/* Single Student Mode - Original Layout */}
                            {numTabs === 1 && (
                                <div className="flex flex-col items-center relative min-h-screen">
                                    {/* Floating student avatars on sides */}
                                    <FloatingStudents
                                        students={availableStudents}
                                        selectedStudent={selectedStudent}
                                        disabled={spinning}
                                    />

                                    {/* Center content */}
                                    <div className="relative z-20">
                                        <div className="text-center mb-8">
                                            <h1 className="text-3xl md:text-4xl font-bold mb-2">
                                                {selectedStudent ? `${selectedStudent.full_name}'s Turn!` : 'Spin to Select a Student'}
                                            </h1>
                                            <p className="text-white/60">
                                                {availableStudents.length} of {students.length} students remaining
                                            </p>
                                        </div>

                                        {availableStudents.length > 0 ? (
                                            <SpinningWheel
                                                segments={availableStudents.map(s => ({ id: s.id, name: s.full_name }))}
                                                onSpinEnd={handleSpinEnd}
                                                spinning={spinning}
                                                setSpinning={setSpinning}
                                            />
                                        ) : (
                                            <div className="bg-white/10 rounded-2xl p-12 text-center">
                                                <Sparkles className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                                                <p className="text-xl text-white/60">All students have participated!</p>
                                                <button
                                                    onClick={() => {
                                                        setAvailableStudents(students)
                                                        setSelectedStudentIds([])
                                                    }}
                                                    className="mt-4 px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                                                >
                                                    Reset & Continue
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Multi-Student Mode - Split Screen Grid */}
                            {numTabs > 1 && (
                                <div className="w-full">
                                    <div className="text-center mb-6">
                                        <h1 className="text-2xl md:text-3xl font-bold mb-2">Select Students for All Panels</h1>
                                        <p className="text-white/60">Click "Spin All Wheels" to select students for all {numTabs} panels simultaneously</p>
                                    </div>

                                    {/* Grid of wheel panels */}
                                    <div
                                        className="grid gap-4 w-full"
                                        style={{
                                            gridTemplateColumns: `repeat(${Math.min(numTabs, 4)}, 1fr)`,
                                        }}
                                    >
                                        {Array.from({ length: numTabs }, (_, i) => {
                                            const tab = tabs[i]
                                            const tabStudent = tab?.selectedStudent
                                            // Get students not used in other tabs (for this panel's wheel)
                                            const panelStudents = availableStudents.filter(s => {
                                                const usedByOtherTabs = tabs
                                                    .filter((_, idx) => idx !== i)
                                                    .map(t => t.selectedStudent?.id)
                                                    .filter(Boolean)
                                                return !usedByOtherTabs.includes(s.id)
                                            })

                                            return (
                                                <div
                                                    key={i}
                                                    className={`bg-white/5 backdrop-blur-sm border rounded-2xl p-4 transition-all ${tab?.phase === 'question'
                                                        ? 'border-yellow-500/50 bg-yellow-500/10'
                                                        : tab?.phase === 'result'
                                                            ? tab?.isCorrect
                                                                ? 'border-green-500/50 bg-green-500/10'
                                                                : 'border-red-500/50 bg-red-500/10'
                                                            : 'border-white/10'
                                                        }`}
                                                >
                                                    {/* Panel Header */}
                                                    <div className="text-center mb-2">
                                                        <h3 className="text-lg font-bold text-cyan-300">Panel {i + 1}</h3>
                                                        {tabStudent && (
                                                            <p className="text-white font-medium text-lg">{tabStudent.full_name}</p>
                                                        )}
                                                    </div>

                                                    {/* Wheel or Selected Student */}
                                                    <div className="flex flex-col items-center justify-center">
                                                        {tabStudent ? (
                                                            // Student selected - show avatar
                                                            <div className="text-center py-4">
                                                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-3 text-3xl font-bold text-white shadow-lg shadow-cyan-500/30">
                                                                    {tabStudent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                                </div>
                                                                <p className="text-green-400 font-medium text-lg">✓ Selected</p>
                                                                {tab?.currentQuestion && (
                                                                    <p className="text-yellow-400 text-sm mt-2">🎯 Question Ready!</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            // Show mini wheel for this panel
                                                            <div className="transform scale-75 origin-center">
                                                                {panelStudents.length > 0 ? (
                                                                    <SpinningWheel
                                                                        segments={panelStudents.map(s => ({ id: s.id, name: s.full_name }))}
                                                                        onSpinEnd={(winner) => {
                                                                            // Individual panel spin - update this tab
                                                                            // Exclude answered questions AND questions already assigned to other panels
                                                                            const usedQuestionIds = tabs.map(t => t.currentQuestion?.id).filter(Boolean) as string[]
                                                                            const availableQs = questions.filter(q =>
                                                                                !answeredQuestions.includes(q.id) && !usedQuestionIds.includes(q.id)
                                                                            )
                                                                            const randomQ = availableQs.length > 0
                                                                                ? availableQs[Math.floor(Math.random() * availableQs.length)]
                                                                                : null

                                                                            updateTab(i, {
                                                                                selectedStudent: { id: winner.id, full_name: winner.name },
                                                                                currentQuestion: randomQ,
                                                                                phase: 'wheel'
                                                                            })
                                                                            setSelectedStudentIds(prev => [...prev, winner.id])
                                                                            setAvailableStudents(prev => prev.filter(s => s.id !== winner.id))

                                                                            // Reset spinning after all panels done
                                                                            setTimeout(() => setSpinning(false), 500)
                                                                        }}
                                                                        spinning={spinning}
                                                                        setSpinning={setSpinning}
                                                                        autoSpin={autoSpinPanels[i] || false}
                                                                    />
                                                                ) : (
                                                                    <div className="text-center py-8">
                                                                        <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-dashed border-white/30 flex items-center justify-center mx-auto mb-3">
                                                                            <span className="text-white/40 text-xl">?</span>
                                                                        </div>
                                                                        <p className="text-white/50 text-sm">No students left</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* All students assigned - show Start Questions button */}
                                    {tabs.length > 0 && tabs.every(t => t.selectedStudent) && (
                                        <div className="text-center mt-8">
                                            <button
                                                onClick={() => {
                                                    // Move all tabs to question phase with fresh timers
                                                    setTabs(prev => prev.map(t => ({ ...t, phase: 'question', timeLeft: QUESTION_TIME_LIMIT })))
                                                    setGamePhase('question')
                                                    // Set first tab's question as current 
                                                    if (tabs[0]?.currentQuestion) {
                                                        setCurrentQuestion(tabs[0].currentQuestion)
                                                        setSelectedStudent(tabs[0].selectedStudent)
                                                    }
                                                }}
                                                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-600 transition shadow-lg transform hover:scale-105"
                                            >
                                                Start Questions for All Students →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* QUESTION PHASE */}
                    {gamePhase === 'question' && (
                        <motion.div
                            key="question"
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            className="w-full"
                        >
                            {/* Single Student Mode */}
                            {numTabs === 1 && currentQuestion && (
                                <div className="max-w-3xl mx-auto">
                                    <div className="text-center mb-8">
                                        <div className="flex items-center justify-center gap-3 mb-4">
                                            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-2">
                                                <Star className="w-4 h-4 text-green-400" />
                                                <span className="text-green-400 font-medium">{selectedStudent?.full_name}'s Question</span>
                                            </div>
                                        </div>

                                        <div className={`text-6xl font-mono font-bold my-4 ${timeLeft <= 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                            {formatTime(timeLeft)}
                                        </div>
                                    </div>

                                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 mb-8">
                                        <MathRenderer content={currentQuestion.content} className="text-xl md:text-2xl font-medium leading-relaxed text-center" />
                                    </div>

                                    {currentQuestion.type === 'mcq' && currentQuestion.options && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {currentQuestion.options.map((option, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAnswer(option)}
                                                    className="p-5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400 rounded-xl text-left transition-all"
                                                >
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold mr-3">
                                                        {String.fromCharCode(65 + idx)}
                                                    </span>
                                                    <MathRenderer content={option} className="text-lg inline" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Integer Input for Single Panel */}
                                    {currentQuestion.type === 'integer' && (
                                        <div className="max-w-md mx-auto">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Type your numerical answer..."
                                                id="single-panel-answer"
                                                className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-center text-2xl font-bold focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition-all placeholder:text-white/30"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleAnswer((e.target as HTMLInputElement).value)
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const input = document.getElementById('single-panel-answer') as HTMLInputElement
                                                    if (input && input.value) {
                                                        handleAnswer(input.value)
                                                    }
                                                }}
                                                className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl font-bold text-lg hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 transition-all shadow-xl shadow-purple-500/30"
                                            >
                                                ✨ Submit Answer
                                            </button>
                                        </div>
                                    )}

                                    {/* Subjective Question - Scratchpad for Single Panel */}
                                    {currentQuestion.type === 'subjective' && (
                                        <div className="text-center">
                                            <p className="text-white/70 mb-4">Write your answer on the scratchpad</p>
                                            <button
                                                onClick={() => setShowBlackboard(true)}
                                                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition shadow-lg transform hover:scale-105"
                                            >
                                                <PenTool className="w-5 h-5" />
                                                Open Scratchpad
                                            </button>
                                            <div className="mt-6">
                                                <button
                                                    onClick={() => handleAnswer('submitted_on_scratchpad')}
                                                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 transition"
                                                >
                                                    ✓ Submit for Teacher Evaluation
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Multi-Student Mode - Split Screen with EXACT SAME UI */}
                            {numTabs > 1 && (
                                <div
                                    className="grid gap-4 w-full min-h-0"
                                    style={{
                                        gridTemplateColumns: `repeat(${Math.min(numTabs, 4)}, 1fr)`,
                                        height: 'calc(100vh - 150px)'
                                    }}
                                >
                                    {tabs.map((tab, i) => {
                                        const q = tab.currentQuestion
                                        const student = tab.selectedStudent
                                        const hasAnswered = tab.selectedAnswer !== null

                                        return (
                                            <div
                                                key={i}
                                                className={`border-r border-white/10 h-full overflow-y-auto custom-scrollbar overscroll-contain isolate relative px-6 py-4 ${i === tabs.length - 1 ? 'border-r-0' : ''}`}
                                                style={{ touchAction: 'pan-y' }}
                                            >
                                                {/* Panel in Wheel Phase - Show SpinningWheel for Next Student */}
                                                {tab.phase === 'wheel' && !student && (() => {
                                                    // Get available students for this panel's wheel
                                                    const usedByOtherTabs = tabs
                                                        .filter((_, idx) => idx !== i)
                                                        .map(t => t.selectedStudent?.id)
                                                        .filter(Boolean) as string[]
                                                    const panelStudents = students.filter(s =>
                                                        !selectedStudentIds.includes(s.id) && !usedByOtherTabs.includes(s.id)
                                                    )

                                                    return panelStudents.length > 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-8">
                                                            <h3 className="text-xl font-bold text-cyan-300 mb-4">🎯 Selecting Next Student...</h3>
                                                            <div className="transform scale-75 origin-center">
                                                                <SpinningWheel
                                                                    segments={panelStudents.map(s => ({ id: s.id, name: s.full_name }))}
                                                                    onSpinEnd={(winner) => {
                                                                        // Get available questions
                                                                        const usedQIds = tabs.map(t => t.currentQuestion?.id).filter(Boolean) as string[]
                                                                        const availableQs = questions.filter(q =>
                                                                            !answeredQuestions.includes(q.id) && !usedQIds.includes(q.id)
                                                                        )
                                                                        const randomQ = availableQs.length > 0
                                                                            ? availableQs[Math.floor(Math.random() * availableQs.length)]
                                                                            : null

                                                                        // Update this panel with new student and question - show announcement first
                                                                        updateTab(i, {
                                                                            phase: 'announcement', // Show student name first, auto-transitions to question
                                                                            selectedStudent: { id: winner.id, full_name: winner.name },
                                                                            currentQuestion: randomQ,
                                                                            timeLeft: QUESTION_TIME_LIMIT
                                                                        })

                                                                        // Track globally
                                                                        setSelectedStudentIds(prev => [...prev, winner.id])
                                                                        if (randomQ) {
                                                                            setAnsweredQuestions(prev => [...prev, randomQ.id])
                                                                        }
                                                                    }}
                                                                    spinning={panelSpinning[i] || false}
                                                                    setSpinning={(val) => setPanelSpinning(prev => prev.map((s, idx) => idx === i ? val : s))}
                                                                    autoSpin={true}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-12">
                                                            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-dashed border-white/30 flex items-center justify-center mx-auto mb-4">
                                                                <Sparkles className="w-8 h-8 text-white/40" />
                                                            </div>
                                                            <p className="text-white/60">All students have participated!</p>
                                                            <p className="text-white/40 text-sm mt-2">Panel {i + 1} complete</p>
                                                        </div>
                                                    )
                                                })()}

                                                {/* Announcement Phase - Show selected student before question */}
                                                {tab.phase === 'announcement' && student && (
                                                    <motion.div
                                                        initial={{ scale: 0.8, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        className="flex flex-col items-center justify-center py-12 text-center"
                                                    >
                                                        {/* Confetti-style decorations */}
                                                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                                            {['🎉', '⭐', '✨', '🌟', '🎊'].map((emoji, idx) => (
                                                                <motion.div
                                                                    key={idx}
                                                                    className="absolute text-3xl"
                                                                    style={{ left: `${15 + idx * 18}%`, top: '10%' }}
                                                                    animate={{ y: [0, 20, 0], rotate: [0, 15, -15, 0] }}
                                                                    transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                                                                >
                                                                    {emoji}
                                                                </motion.div>
                                                            ))}
                                                        </div>

                                                        {/* Avatar */}
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: 'spring', delay: 0.2 }}
                                                            className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center text-5xl font-bold text-white shadow-2xl shadow-orange-500/40 mb-6 border-4 border-white/30"
                                                        >
                                                            {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                        </motion.div>

                                                        {/* Student Name */}
                                                        <motion.h2
                                                            initial={{ y: 20, opacity: 0 }}
                                                            animate={{ y: 0, opacity: 1 }}
                                                            transition={{ delay: 0.4 }}
                                                            className="text-4xl font-bold text-white mb-3"
                                                        >
                                                            {student.full_name}
                                                        </motion.h2>

                                                        {/* Get Ready Message */}
                                                        <motion.div
                                                            initial={{ y: 20, opacity: 0 }}
                                                            animate={{ y: 0, opacity: 1 }}
                                                            transition={{ delay: 0.6 }}
                                                            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-full text-xl font-bold shadow-lg shadow-green-500/30"
                                                        >
                                                            🎯 It's Your Turn!
                                                        </motion.div>

                                                        {/* Countdown indicator */}
                                                        <motion.p
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                            className="text-white/60 mt-6 text-sm"
                                                        >
                                                            Question coming up...
                                                        </motion.p>
                                                    </motion.div>
                                                )}

                                                {/* Panel with Question and Student - show for both question and result phases */}
                                                {(tab.phase === 'question' || tab.phase === 'result') && q && student && (
                                                    <div className="max-w-full mx-auto">
                                                        {/* Student Header with Question Info */}
                                                        <div className="text-center mb-6">
                                                            <div className="flex items-center justify-center gap-3 mb-4">
                                                                <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-2">
                                                                    <Star className="w-4 h-4 text-green-400" />
                                                                    <span className="text-green-400 font-medium">{student.full_name}'s Question</span>
                                                                </div>
                                                                {hasAnswered && (
                                                                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-2">
                                                                        <span className="text-emerald-400 text-sm">✓ Answered</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Timer for this panel with +/- controls */}
                                                            <div className="flex items-center justify-center gap-3 my-3">
                                                                {/* Minus 1 minute */}
                                                                <button
                                                                    onClick={() => updateTab(i, { timeLeft: Math.max(0, tab.timeLeft - 60) })}
                                                                    className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 font-bold text-xl hover:bg-red-500/40 transition flex items-center justify-center"
                                                                    title="Remove 1 minute"
                                                                >
                                                                    −
                                                                </button>

                                                                {/* Timer display */}
                                                                <div className={`text-4xl font-mono font-bold min-w-[100px] text-center ${tab.timeLeft <= 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                                                    {formatTime(tab.timeLeft)}
                                                                </div>

                                                                {/* Plus 1 minute */}
                                                                <button
                                                                    onClick={() => updateTab(i, { timeLeft: tab.timeLeft + 60 })}
                                                                    className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/50 text-green-400 font-bold text-xl hover:bg-green-500/40 transition flex items-center justify-center"
                                                                    title="Add 1 minute"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>

                                                            {/* Difficulty and Points */}
                                                            <div className="flex justify-center gap-4 text-sm">
                                                                <span className={`px-3 py-1 rounded-full ${q.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                                                                    q.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                        'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                    {q.difficulty || 'medium'}
                                                                </span>
                                                                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400">
                                                                    +{q.points} pts
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Question Content */}
                                                        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 mb-4">
                                                            <MathRenderer
                                                                content={q.content}
                                                                className="text-lg md:text-xl font-medium leading-relaxed text-center"
                                                            />
                                                        </div>

                                                        {/* Skip Question Button - only show if not answered */}
                                                        {!hasAnswered && (
                                                            <div className="flex justify-center mb-4">
                                                                <button
                                                                    onClick={() => handleSkipQuestion(i)}
                                                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-xl transition text-red-400 hover:text-red-300 text-sm"
                                                                >
                                                                    <SkipForward className="w-4 h-4" />
                                                                    <span>Skip Question</span>
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Scratchpad Toggle + Embedded Blackboard - per panel */}
                                                        {!tab.showBlackboard ? (
                                                            <div className="flex justify-center mb-4">
                                                                <button
                                                                    onClick={() => updateTab(i, { showBlackboard: true })}
                                                                    className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-white/10 rounded-xl transition text-white/80 hover:text-white"
                                                                >
                                                                    <PenTool className="w-4 h-4" />
                                                                    <span>Open Scratchpad</span>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <InlineBlackboard
                                                                isOpen={tab.showBlackboard}
                                                                onClose={() => updateTab(i, { showBlackboard: false })}
                                                                studentName={student.full_name}
                                                            />
                                                        )}

                                                        {/* MCQ Options - Exact same styling */}
                                                        {q.type === 'mcq' && q.options && !hasAnswered && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {q.options.map((option, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => handleTabAnswer(i, option)}
                                                                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400 rounded-xl text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] group"
                                                                    >
                                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold mr-3 group-hover:bg-indigo-500 group-hover:text-white transition">
                                                                            {String.fromCharCode(65 + idx)}
                                                                        </span>
                                                                        <MathRenderer content={option} className="text-base inline" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Integer Input - Same styling */}
                                                        {q.type === 'integer' && !hasAnswered && (
                                                            <div className="max-w-md mx-auto">
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    placeholder="Type your answer..."
                                                                    id={`answer-input-${i}`}
                                                                    className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-center text-2xl font-bold focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition-all placeholder:text-white/30"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleTabAnswer(i, (e.target as HTMLInputElement).value)
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        const input = document.getElementById(`answer-input-${i}`) as HTMLInputElement
                                                                        if (input && input.value) {
                                                                            handleTabAnswer(i, input.value)
                                                                        }
                                                                    }}
                                                                    className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl font-bold text-lg hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 transition-all shadow-xl shadow-purple-500/30"
                                                                >
                                                                    ✨ Submit Answer
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Result State - Show teacher scoring or result based on question type */}
                                                        {hasAnswered && (
                                                            <>
                                                                {/* Teacher Scoring UI for Integer/Subjective */}
                                                                {tab.awaitingTeacherScore && (q.type === 'integer' || q.type === 'subjective') ? (
                                                                    <div className="text-center py-4 rounded-2xl border bg-amber-500/10 border-amber-500/30">
                                                                        <p className="text-amber-400 font-bold text-lg mb-3">📝 Teacher Evaluation</p>

                                                                        {/* Show student's answer */}
                                                                        <div className="bg-white/10 rounded-xl p-3 mb-3 mx-4">
                                                                            <p className="text-white/60 text-xs mb-1">Student's Answer:</p>
                                                                            <p className="text-white font-medium">{tab.selectedAnswer}</p>
                                                                        </div>

                                                                        {/* Show expected answer */}
                                                                        <div className="bg-green-500/10 rounded-xl p-3 mb-4 mx-4">
                                                                            <p className="text-white/60 text-xs mb-1">Expected Answer:</p>
                                                                            <p className="text-green-400 font-medium">{q.correct_answer}</p>
                                                                        </div>

                                                                        <p className="text-white/70 text-sm mb-3">Award points based on answer quality:</p>

                                                                        {/* Point buttons */}
                                                                        <div className="grid grid-cols-6 gap-2 px-4 mb-3">
                                                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -5].map(pts => (
                                                                                <button
                                                                                    key={pts}
                                                                                    onClick={() => handleTabTeacherAwardPoints(i, pts)}
                                                                                    className={`py-2 rounded-lg font-bold text-sm transition transform hover:scale-105 ${pts < 0
                                                                                        ? 'bg-red-500/30 border border-red-500/50 text-red-400 hover:bg-red-500/50'
                                                                                        : pts === 0
                                                                                            ? 'bg-gray-500/30 border border-gray-500/50 text-gray-400 hover:bg-gray-500/50'
                                                                                            : 'bg-green-500/30 border border-green-500/50 text-green-400 hover:bg-green-500/50'
                                                                                        }`}
                                                                                >
                                                                                    {pts > 0 ? `+${pts}` : pts}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* Normal result for MCQ or after teacher scoring */
                                                                    <div className={`text-center py-6 rounded-2xl border ${tab.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                                                        <p className={`font-bold text-xl ${tab.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {tab.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                                                        </p>
                                                                        {!tab.isCorrect && (
                                                                            <p className="text-white/60 mt-1 text-sm">Answer: {q.correct_answer}</p>
                                                                        )}
                                                                        <p className="text-cyan-400 mt-2">
                                                                            +{tab.teacherAwardedPoints !== null ? tab.teacherAwardedPoints : (tab.isCorrect ? q.points : 0)} pts
                                                                        </p>

                                                                        {/* Next Student Button */}
                                                                        <button
                                                                            onClick={() => handleTabNextStudent(i)}
                                                                            className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold text-sm hover:from-purple-600 hover:to-pink-600 transition"
                                                                        >
                                                                            🎯 Next Student for Panel {i + 1}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* RESULT PHASE */}
                    {
                        gamePhase === 'result' && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="max-w-2xl mx-auto text-center"
                            >
                                {/* Teacher Scoring UI for Integer/Subjective */}
                                {awaitingTeacherScore && currentQuestion && (currentQuestion.type === 'integer' || currentQuestion.type === 'subjective') ? (
                                    <div className="space-y-6">
                                        <h1 className="text-3xl font-bold text-white mb-4">📝 Teacher Scoring</h1>
                                        <p className="text-white/70 mb-2">
                                            <span className="font-bold text-yellow-400">{selectedStudent?.full_name}</span> answered:
                                        </p>

                                        {/* Show correct answer */}
                                        <div className="bg-white/10 rounded-xl p-6 mb-6">
                                            <p className="text-sm text-white/60 mb-2">Expected Answer:</p>
                                            <p className="text-xl font-bold text-green-400 mb-4">{currentQuestion.correct_answer}</p>
                                            <p className="text-sm text-white/60 mb-1">Student's answer is on the blackboard</p>
                                        </div>

                                        <p className="text-lg text-white/80 mb-4">Award points based on the answer quality:</p>

                                        {/* Point buttons 1-10 */}
                                        <div className="grid grid-cols-5 gap-3 mb-6">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pts => (
                                                <button
                                                    key={pts}
                                                    onClick={() => handleTeacherAwardPoints(pts)}
                                                    className="py-4 bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-2 border-green-400/50 rounded-xl font-bold text-lg text-green-400 hover:from-green-500/50 hover:to-emerald-500/50 hover:border-green-400 transition transform hover:scale-105"
                                                >
                                                    +{pts}
                                                </button>
                                            ))}
                                        </div>

                                        {/* No Points and Penalty buttons */}
                                        <div className="flex gap-4 justify-center">
                                            <button
                                                onClick={() => handleTeacherAwardPoints(0)}
                                                className="px-8 py-4 bg-gray-500/30 border-2 border-gray-400/50 rounded-xl font-bold text-gray-300 hover:bg-gray-500/50 hover:border-gray-400 transition"
                                            >
                                                No Points (0)
                                            </button>
                                            {score > 0 && (
                                                <button
                                                    onClick={() => handleTeacherAwardPoints(-1)}
                                                    className="px-8 py-4 bg-red-500/30 border-2 border-red-400/50 rounded-xl font-bold text-red-400 hover:bg-red-500/50 hover:border-red-400 transition"
                                                >
                                                    Penalty (-1)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* MCQ Result or Post-Teacher Scoring */
                                    <>
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', damping: 10 }}
                                            className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-8 ${isCorrect === null
                                                ? 'bg-gray-500'
                                                : isCorrect
                                                    ? 'bg-green-500'
                                                    : 'bg-red-500'
                                                }`}
                                        >
                                            {isCorrect === null ? (
                                                <Clock className="w-20 h-20 text-white" />
                                            ) : isCorrect ? (
                                                <CheckCircle className="w-20 h-20 text-white" />
                                            ) : (
                                                <XCircle className="w-20 h-20 text-white" />
                                            )}
                                        </motion.div>

                                        <h1 className={`text-4xl font-bold mb-4 ${isCorrect === null
                                            ? 'text-gray-400'
                                            : isCorrect
                                                ? 'text-green-400'
                                                : 'text-red-400'
                                            }`}>
                                            {isCorrect === null
                                                ? '⏳ Awaiting Score'
                                                : isCorrect
                                                    ? '🎉 Correct!'
                                                    : timeLeft === 0
                                                        ? '⏰ Time\'s Up!'
                                                        : '❌ Incorrect'}
                                        </h1>

                                        <p className="text-xl text-white/80 mb-2">
                                            {selectedStudent?.full_name} {isCorrect ? 'earned' : teacherAwardedPoints === 0 ? 'received' : 'missed'}
                                        </p>
                                        <p className={`text-5xl font-bold mb-8 ${teacherAwardedPoints !== null
                                            ? teacherAwardedPoints > 0
                                                ? 'text-green-400'
                                                : teacherAwardedPoints < 0
                                                    ? 'text-red-400'
                                                    : 'text-white/40'
                                            : isCorrect
                                                ? 'text-green-400'
                                                : 'text-white/40'
                                            }`}>
                                            {teacherAwardedPoints !== null
                                                ? teacherAwardedPoints >= 0
                                                    ? `+${teacherAwardedPoints}`
                                                    : teacherAwardedPoints
                                                : isCorrect
                                                    ? `+${currentQuestion?.points || 10}`
                                                    : '0'} pts
                                        </p>

                                        {!isCorrect && currentQuestion && currentQuestion.type === 'mcq' && (
                                            <div className="bg-white/10 rounded-xl p-6 mb-8">
                                                <p className="text-sm text-white/60 mb-2">Correct Answer:</p>
                                                <p className="text-xl font-bold text-green-400">{currentQuestion.correct_answer}</p>
                                            </div>
                                        )}

                                        {/* Solution Display */}
                                        {currentQuestion && (currentQuestion.solution_text || currentQuestion.solution_image_url) && (
                                            <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 rounded-xl p-6 mb-8 text-left">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Brain className="w-5 h-5 text-indigo-400" />
                                                    <h3 className="text-lg font-bold text-indigo-300">Solution</h3>
                                                </div>
                                                {currentQuestion.solution_text && (
                                                    <p className="text-white/80 leading-relaxed whitespace-pre-wrap mb-4">
                                                        {currentQuestion.solution_text}
                                                    </p>
                                                )}
                                                {currentQuestion.solution_image_url && (
                                                    <img
                                                        src={currentQuestion.solution_image_url}
                                                        alt="Solution"
                                                        className="max-w-full h-auto rounded-lg border border-white/20 mx-auto"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        <button
                                            onClick={nextRound}
                                            disabled={awaitingTeacherScore}
                                            className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full font-bold text-lg hover:from-indigo-600 hover:to-purple-600 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next Round
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </motion.div>
                        )
                    }
                </AnimatePresence >
            </div >
            {/* Blackboard Component - Global only */}
            < Blackboard
                isOpen={showBlackboard}
                onClose={() => setShowBlackboard(false)}
            />

            {/* Save Game Modal */}
            <AnimatePresence>
                {showSaveModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowSaveModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">💾 Save Game</h2>
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    <X className="w-5 h-5 text-white/60" />
                                </button>
                            </div>

                            <p className="text-white/70 mb-4">
                                Save your current game progress to continue later. Students who haven't played yet will be available when you resume.
                            </p>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                    Game Name
                                </label>
                                <input
                                    type="text"
                                    value={gameName}
                                    onChange={(e) => setGameName(e.target.value)}
                                    placeholder="e.g., Class 7 Physics - Session 2"
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveGame}
                                    disabled={!gameName.trim() || isSaving}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Game
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    )
}
