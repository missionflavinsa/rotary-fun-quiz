'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { createTeacher } from './actions'
import { createClient } from '@/lib/supabase/client'

type Teacher = {
    id: string
    full_name: string | null
    email: string
    created_at: string
}

export default function TeachersPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [fetching, setFetching] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const supabase = createClient()

    // Fetch teachers from database
    const fetchTeachers = async () => {
        setFetching(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, created_at')
            .eq('role', 'teacher')
            .order('created_at', { ascending: false })

        if (data) setTeachers(data)
        setFetching(false)
    }

    useEffect(() => {
        fetchTeachers()
    }, [])

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        const res = await createTeacher(formData)
        setIsLoading(false)
        if (res?.error) {
            alert(res.error)
        } else {
            setIsModalOpen(false)
            fetchTeachers() // Refresh the list
        }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Teacher Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage access and permissions for teachers</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchTeachers}
                        disabled={fetching}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30"
                    >
                        <Plus className="w-5 h-5" />
                        Add Teacher
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search teachers..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                        />
                    </div>
                </div>

                {fetching ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-500" />
                        Loading teachers...
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Joined</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {teachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4 font-medium text-gray-900">{teacher.full_name || 'Unnamed'}</td>
                                        <td className="px-6 py-4">{teacher.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">Active</span>
                                        </td>
                                        <td className="px-6 py-4">{teacher.created_at?.slice(0, 10) || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-red-500 hover:bg-red-50 p-2 rounded transition">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {teachers.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                No teachers found. Add one to get started.
                            </div>
                        )}
                    </>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Teacher">
                <form action={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input name="name" type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="e.g. John Doe" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input name="email" type="email" required className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="teacher@school.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="relative">
                            <input
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {isLoading ? 'Creating...' : 'Create Teacher'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
