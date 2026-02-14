'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Trophy, Users, Calendar, Gamepad2, RefreshCw, Eye, ChevronRight, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type GameSession = {
    id: string
    started_at: string
    ended_at: string | null
    total_questions: number
    status: string
    classes?: { name: string; section: string } | null
    subjects?: { name: string } | null
    profiles?: { full_name: string } | null
}

type GameResult = {
    id: string
    is_correct: boolean
    points_earned: number
    student_answer?: string | null
    students?: { full_name: string } | null
    questions?: { content: string } | null
}

export default function GameHistoryPage() {
    const [games, setGames] = useState<GameSession[]>([])
    const [fetching, setFetching] = useState(true)
    const [selectedGame, setSelectedGame] = useState<string | null>(null)
    const [gameResults, setGameResults] = useState<GameResult[]>([])
    const [loadingResults, setLoadingResults] = useState(false)
    const supabase = createClient()

    const fetchGames = async () => {
        setFetching(true)

        // Get current user's ID to filter games
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id

        let query = supabase
            .from('game_sessions')
            .select('id, started_at, ended_at, total_questions, status, classes(name, section), subjects(name), profiles(full_name)')
            .order('started_at', { ascending: false })
            .limit(50)

        // Filter by teacher_id if user is logged in
        if (userId) {
            query = query.eq('teacher_id', userId)
        }

        const { data, error } = await query

        console.log('Game sessions:', data, error)
        if (data) setGames(data as unknown as GameSession[])
        setFetching(false)
    }

    const fetchResults = async (sessionId: string) => {
        setLoadingResults(true)
        const { data } = await supabase
            .from('game_results')
            .select('id, is_correct, points_earned, student_answer, students(full_name), questions(content)')
            .eq('session_id', sessionId)
            .order('answered_at', { ascending: true })

        if (data) setGameResults(data as unknown as GameResult[])
        setLoadingResults(false)
    }

    useEffect(() => {
        fetchGames()
    }, [])

    const toggleGameDetails = (gameId: string) => {
        if (selectedGame === gameId) {
            setSelectedGame(null)
            setGameResults([])
        } else {
            setSelectedGame(gameId)
            fetchResults(gameId)
        }
    }

    const getTotalScore = (results: GameResult[]) => {
        return results.reduce((sum, r) => sum + (r.points_earned || 0), 0)
    }

    const getCorrectCount = (results: GameResult[]) => {
        return results.filter(r => r.is_correct).length
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Game History
                    </h1>
                    <p className="text-gray-500 mt-1">View all past quiz sessions and their results</p>
                </div>
                <button
                    onClick={fetchGames}
                    disabled={fetching}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {fetching ? (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
                    <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    Loading game history...
                </div>
            ) : games.length > 0 ? (
                <div className="space-y-4">
                    {games.map((game, idx) => (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition"
                        >
                            <div
                                className="p-6 cursor-pointer"
                                onClick={() => toggleGameDetails(game.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${game.status === 'completed' ? 'bg-green-100' :
                                            game.status === 'active' ? 'bg-yellow-100' : 'bg-gray-100'
                                            }`}>
                                            <Gamepad2 className={`w-6 h-6 ${game.status === 'completed' ? 'text-green-600' :
                                                game.status === 'active' ? 'text-yellow-600' : 'text-gray-600'
                                                }`} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">
                                                {game.classes?.name || 'Unknown Class'} {game.classes?.section ? `- ${game.classes.section}` : ''}
                                            </h3>
                                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                                <span>{game.subjects?.name || 'General Quiz'}</span>
                                                {game.profiles?.full_name && (
                                                    <>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {game.profiles.full_name}
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(game.started_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Clock className="w-4 h-4" />
                                            <span>{new Date(game.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${game.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            game.status === 'active' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {game.status || 'active'}
                                        </span>
                                        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedGame === game.id ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Results Section */}
                            <AnimatePresence>
                                {selectedGame === game.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-gray-100 bg-gray-50"
                                    >
                                        <div className="p-6">
                                            {loadingResults ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                                    Loading results...
                                                </div>
                                            ) : gameResults.length > 0 ? (
                                                <>
                                                    {/* Stats Summary */}
                                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                                        <div className="bg-white rounded-xl p-4 text-center border">
                                                            <p className="text-2xl font-bold text-indigo-600">{gameResults.length}</p>
                                                            <p className="text-sm text-gray-500">Questions</p>
                                                        </div>
                                                        <div className="bg-white rounded-xl p-4 text-center border">
                                                            <p className="text-2xl font-bold text-green-600">{getCorrectCount(gameResults)}</p>
                                                            <p className="text-sm text-gray-500">Correct</p>
                                                        </div>
                                                        <div className="bg-white rounded-xl p-4 text-center border">
                                                            <p className="text-2xl font-bold text-yellow-600">{getTotalScore(gameResults)}</p>
                                                            <p className="text-sm text-gray-500">Total Points</p>
                                                        </div>
                                                    </div>

                                                    {/* Results List */}
                                                    <div className="space-y-2">
                                                        {gameResults.map((result, i) => (
                                                            <div key={result.id} className={`flex items-center gap-4 p-3 rounded-lg ${result.is_correct ? 'bg-green-50' : 'bg-red-50'
                                                                }`}>
                                                                <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold bg-white">
                                                                    {i + 1}
                                                                </span>
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-gray-900">{result.students?.full_name || 'Unknown'}</p>
                                                                    <p className="text-sm text-gray-500 truncate">
                                                                        {result.questions?.content?.slice(0, 60) || (() => {
                                                                            try {
                                                                                const parsed = JSON.parse(result.student_answer || '')
                                                                                return parsed.question_content?.slice(0, 60) || 'AI Question'
                                                                            } catch { return 'AI Question' }
                                                                        })()}...
                                                                    </p>
                                                                </div>
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${result.is_correct ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                                                    }`}>
                                                                    {result.is_correct ? `+${result.points_earned}` : 'Incorrect'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <Eye className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                    No results recorded for this session
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border p-16 text-center text-gray-500">
                    <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">No games played yet</h3>
                    <p className="mb-6">Start a quiz to see your history here!</p>
                    <Link
                        href="/game"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium"
                    >
                        <Gamepad2 className="w-5 h-5" />
                        Start New Game
                    </Link>
                </div>
            )}
        </div>
    )
}
