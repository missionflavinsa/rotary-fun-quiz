'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Gamepad2, Trophy, Users, Clock, TrendingUp, Star } from 'lucide-react'
import Link from 'next/link'

type GameSession = {
    id: string
    started_at: string
    total_questions: number
    game_score: number
    classes?: { name: string }
}

type TopStudent = {
    id: string
    full_name: string
    total_points: number
    current_level: number
}

export default function TeacherDashboard() {
    const [recentGames, setRecentGames] = useState<GameSession[]>([])
    const [topStudents, setTopStudents] = useState<TopStudent[]>([])
    const [userName, setUserName] = useState<string>('')
    const [stats, setStats] = useState({
        totalGames: 0,
        totalStudents: 0,
        avgScore: 0
    })

    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            // Get current user's name
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()
                if (profile?.full_name) setUserName(profile.full_name)
            }

            // Get recent games (filtered by this teacher)
            const fetchTime = new Date()
            fetchTime.setDate(fetchTime.getDate() - 7) // Last 7 days

            let gamesQuery = supabase
                .from('game_sessions')
                .select('id, started_at, total_questions, game_score, classes(name)')
                .gte('started_at', fetchTime.toISOString())
                .order('started_at', { ascending: false })
                .limit(10)

            // Filter by teacher_id if user is logged in
            if (user?.id) {
                gamesQuery = gamesQuery.eq('teacher_id', user.id)
            }

            const { data: games, error: gamesError } = await gamesQuery

            if (gamesError) {
                console.error('Error fetching teacher recent games:', gamesError)
            }

            if (games) setRecentGames(games as unknown as GameSession[])

            // Get top students
            const { data: students } = await supabase
                .from('students')
                .select('id, full_name, total_points, current_level')
                .order('total_points', { ascending: false })
                .limit(5)
            if (students) setTopStudents(students)

            // Get stats
            const { count: gameCount } = await supabase
                .from('game_sessions')
                .select('*', { count: 'exact', head: true })

            const { count: studentCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })

            setStats({
                totalGames: gameCount || 0,
                totalStudents: studentCount || 0,
                avgScore: 0
            })
        }
        fetchData()
    }, [])

    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                    Teacher Dashboard
                </h1>
                <p className="text-gray-500 mt-1">Welcome back{userName ? `, ${userName}` : ''}! Ready to host a quiz?</p>
            </div>

            {/* Quick Action */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-8 text-white"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Start a New Quiz</h2>
                        <p className="text-white/80">Select your class, subject, and topics to begin</p>
                    </div>
                    <Link
                        href="/game"
                        className="flex items-center gap-2 bg-white text-green-600 px-6 py-3 rounded-xl font-bold hover:bg-white/90 transition transform hover:scale-105"
                    >
                        <Gamepad2 className="w-5 h-5" />
                        Start Game
                    </Link>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                            <Gamepad2 className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Games Hosted</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalGames}</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-xl">
                            <Users className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Students</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Avg Score</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.avgScore}</p>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Games */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-500" />
                        <h3 className="font-bold text-gray-900">Recent Games</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {recentGames.length > 0 ? recentGames.map(game => (
                            <div key={game.id} className="p-4 hover:bg-gray-50 transition">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-gray-900">{game.classes?.name || 'Unknown Class'}</p>
                                        <p className="text-sm text-gray-500">{new Date(game.started_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600">{game.game_score} pts</p>
                                        <p className="text-sm text-gray-500">{game.total_questions || 0} questions</p>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-gray-500">
                                <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>No games yet. Start one!</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Top Students */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <h3 className="font-bold text-gray-900">Top Performers</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {topStudents.length > 0 ? topStudents.map((student, idx) => (
                            <div key={student.id} className="p-4 hover:bg-gray-50 transition flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                                            'bg-gray-50 text-gray-500'
                                    }`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{student.full_name}</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Star className="w-3 h-3 text-yellow-500" />
                                        Level {student.current_level || 1}
                                    </div>
                                </div>
                                <p className="font-bold text-green-600">{student.total_points || 0} pts</p>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-gray-500">
                                <Trophy className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>No student data yet</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
