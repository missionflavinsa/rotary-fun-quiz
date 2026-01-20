'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
    Users, GraduationCap, Gamepad2, Trophy, TrendingUp,
    BookOpen, Calendar, ChevronRight, Star, Award, Target
} from 'lucide-react'

// Animated counter component
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        let start = 0
        const end = value
        const increment = end / (duration * 60)

        const timer = setInterval(() => {
            start += increment
            if (start >= end) {
                setCount(end)
                clearInterval(timer)
            } else {
                setCount(Math.floor(start))
            }
        }, 1000 / 60)

        return () => clearInterval(timer)
    }, [value, duration])

    return <>{count}</>
}

// Stat card component
function StatCard({ icon: Icon, label, value, color, trend }: {
    icon: any
    label: string
    value: number
    color: string
    trend?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
        >
            <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>
            <div className="mt-4">
                <p className="text-3xl font-bold text-gray-900">
                    <AnimatedCounter value={value} />
                </p>
                <p className="text-gray-500 text-sm mt-1">{label}</p>
            </div>
        </motion.div>
    )
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalTeachers: 0,
        totalStudents: 0,
        totalQuestions: 0,
        totalGames: 0,
        totalPoints: 0
    })
    const [recentGames, setRecentGames] = useState<any[]>([])
    const [topStudents, setTopStudents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true)

            // Fetch counts
            const [teachersRes, studentsRes, questionsRes, gamesRes] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
                supabase.from('students').select('*', { count: 'exact', head: true }),
                supabase.from('questions').select('*', { count: 'exact', head: true }),
                supabase.from('game_sessions').select('*', { count: 'exact', head: true })
            ])

            // Fetch top students
            const { data: topStudentsData } = await supabase
                .from('students')
                .select('id, full_name, total_points, current_level')
                .order('total_points', { ascending: false })
                .limit(5)

            // Fetch recent games
            const fetchTime = new Date()
            fetchTime.setDate(fetchTime.getDate() - 1) // Last 24 hours

            const { data: recentGamesData, error: recentGamesError } = await supabase
                .from('game_sessions')
                .select(`
          id,
          started_at,
          status,
          total_questions,
          classes (name, section),
          subjects (name),
          profiles (full_name)
        `)
                .gte('started_at', fetchTime.toISOString())
                .order('started_at', { ascending: false })

            if (recentGamesError) {
                console.error('Error fetching admin recent games:', recentGamesError)
            }

            setStats({
                totalTeachers: teachersRes.count || 0,
                totalStudents: studentsRes.count || 0,
                totalQuestions: questionsRes.count || 0,
                totalGames: gamesRes.count || 0,
                totalPoints: 0 // Calculate from results if needed
            })

            setTopStudents(topStudentsData || [])
            setRecentGames(recentGamesData || [])
            setLoading(false)
        }

        fetchDashboardData()
    }, [])

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-3xl font-bold text-gray-900">
                        Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Super Admin</span>
                    </h1>
                    <p className="text-gray-500 mt-1">Here's what's happening with your quiz platform</p>
                </motion.div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    icon={Users}
                    label="Total Teachers"
                    value={stats.totalTeachers}
                    color="bg-gradient-to-br from-indigo-500 to-purple-600"
                    trend={12}
                />
                <StatCard
                    icon={GraduationCap}
                    label="Total Students"
                    value={stats.totalStudents}
                    color="bg-gradient-to-br from-emerald-500 to-teal-600"
                    trend={8}
                />
                <StatCard
                    icon={BookOpen}
                    label="Questions in Bank"
                    value={stats.totalQuestions}
                    color="bg-gradient-to-br from-orange-500 to-pink-600"
                    trend={24}
                />
                <StatCard
                    icon={Gamepad2}
                    label="Games Conducted"
                    value={stats.totalGames}
                    color="bg-gradient-to-br from-blue-500 to-cyan-600"
                    trend={15}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Games */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">Recent Games</h2>
                        </div>
                        <Link href="/admin/games" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
                            View All <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {recentGames.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {recentGames.map((game, idx) => (
                                <div key={game.id} className="p-4 hover:bg-gray-50 transition flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                            <Gamepad2 className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {game.classes?.name} - {game.subjects?.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                by {game.profiles?.full_name || 'Unknown'} • {new Date(game.started_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${game.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            game.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {game.status}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {game.total_questions} Qs
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No games conducted yet</p>
                            <p className="text-sm text-gray-400 mt-1">Games will appear here once teachers start conducting quizzes</p>
                        </div>
                    )}
                </motion.div>

                {/* Leaderboard */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Trophy className="w-5 h-5 text-yellow-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Top Performers</h2>
                    </div>

                    {topStudents.length > 0 ? (
                        <div className="p-4 space-y-3">
                            {topStudents.map((student, idx) => (
                                <div
                                    key={student.id}
                                    className={`flex items-center gap-4 p-3 rounded-xl transition ${idx === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' :
                                        idx === 1 ? 'bg-gray-50' :
                                            idx === 2 ? 'bg-orange-50/50' : ''
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                        idx === 1 ? 'bg-gray-300 text-gray-700' :
                                            idx === 2 ? 'bg-orange-300 text-orange-900' :
                                                'bg-gray-100 text-gray-500'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
                                        <div className="flex items-center gap-2">
                                            <Star className="w-3 h-3 text-yellow-500" />
                                            <span className="text-xs text-gray-500">Level {student.current_level || 1}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600">{student.total_points || 0}</p>
                                        <p className="text-xs text-gray-500">points</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <Award className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No scores yet</p>
                            <p className="text-sm text-gray-400 mt-1">Students will appear here after playing</p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
                <Link href="/admin/teachers"
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 hover:shadow-lg transition group"
                >
                    <Users className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition" />
                    <div>
                        <p className="font-medium text-gray-900">Manage Teachers</p>
                        <p className="text-sm text-gray-500">Add, edit or remove teachers</p>
                    </div>
                </Link>

                <Link href="/admin/students"
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 hover:shadow-lg transition group"
                >
                    <GraduationCap className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition" />
                    <div>
                        <p className="font-medium text-gray-900">Manage Students</p>
                        <p className="text-sm text-gray-500">View classes and students</p>
                    </div>
                </Link>

                <Link href="/game"
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl border border-orange-100 hover:shadow-lg transition group"
                >
                    <Target className="w-8 h-8 text-orange-600 group-hover:scale-110 transition" />
                    <div>
                        <p className="font-medium text-gray-900">Start New Game</p>
                        <p className="text-sm text-gray-500">Launch a quiz session</p>
                    </div>
                </Link>
            </motion.div>
        </div>
    )
}
