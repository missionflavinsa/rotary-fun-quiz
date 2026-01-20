'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
    LayoutDashboard, Users, BookOpen, Settings, LogOut,
    GraduationCap, Gamepad2, FileQuestion, Layers, School
} from 'lucide-react'

const adminItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Teachers', href: '/admin/teachers', icon: Users },
    { name: 'Students', href: '/admin/students', icon: GraduationCap },
    { name: 'Classes', href: '/admin/classes', icon: School },
    { name: 'Subjects & Topics', href: '/admin/subjects', icon: Layers },
    { name: 'Questions', href: '/admin/questions', icon: FileQuestion },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
]

const teacherItems = [
    { name: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
    { name: 'Questions', href: '/teacher/questions', icon: FileQuestion },
    { name: 'Start Game', href: '/game', icon: Gamepad2 },
    { name: 'Game History', href: '/teacher/history', icon: BookOpen },
]

export function Sidebar() {
    const pathname = usePathname()
    const isTeacher = pathname?.startsWith('/teacher')
    const role = isTeacher ? 'teacher' : 'admin'
    const items = isTeacher ? teacherItems : adminItems

    return (
        <div className="hidden md:flex w-64 flex-col bg-slate-900 text-white h-screen sticky top-0 shadow-xl z-50">
            <div className="p-6 border-b border-slate-700/50">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Rotary Quiz
                </h1>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-2">
                    <span className={clsx("w-2 h-2 rounded-full", isTeacher ? "bg-indigo-500" : "bg-purple-500")}></span>
                    {role === 'admin' ? 'Super Admin' : 'Teacher'} Portal
                </p>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin' && item.href !== '/teacher' && pathname?.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative',
                                isActive
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 translate-x-1'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
                            )}
                        >
                            <item.icon className={clsx("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                            <span className="font-medium text-sm">{item.name}</span>
                            {isActive && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>
                            )}
                        </Link>
                    )
                })}
            </nav>
            <div className="p-4 border-t border-slate-700/50">
                <Link
                    href="/game"
                    className="flex items-center gap-3 px-4 py-3 mb-2 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl transition-colors hover:from-green-700 hover:to-emerald-700"
                >
                    <Gamepad2 className="w-5 h-5" />
                    <span className="font-medium">Start Game</span>
                </Link>
                <Link
                    href="/login"
                    className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors group"
                >
                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Sign Out</span>
                </Link>
            </div>
        </div>
    )
}
