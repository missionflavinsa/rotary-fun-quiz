'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, RefreshCw, GraduationCap, Upload, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { CSVUploader } from '@/components/csv/CSVUploader'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

type Student = {
    id: string
    full_name: string
    roll_no: string | null
    total_points: number
    current_level: number
    classes: { name: string; section: string } | null
}

type ClassItem = {
    id: string
    name: string
    section: string
}

export default function StudentsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [students, setStudents] = useState<Student[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [fetching, setFetching] = useState(true)
    const [selectedClass, setSelectedClass] = useState('')
    const [showBulkUpload, setShowBulkUpload] = useState(false)

    // Bulk Edit State
    const [selectedStudents, setSelectedStudents] = useState<string[]>([])

    const supabase = createClient()

    const fetchStudents = async () => {
        setFetching(true)
        let query = supabase
            .from('students')
            .select('id, full_name, roll_no, total_points, current_level, classes(name, section)')
            .order('roll_no', { ascending: true })

        if (selectedClass) {
            query = query.eq('class_id', selectedClass)
        }

        const { data } = await query
        if (data) {
            // Transform the data to match our Student type
            const students = data.map((s: any) => ({
                ...s,
                classes: Array.isArray(s.classes) ? s.classes[0] : s.classes
            }))
            setStudents(students as Student[])
        }
        setFetching(false)
    }

    const fetchClasses = async () => {
        const { data } = await supabase.from('classes').select('id, name, section')
        if (data) setClasses(data)
    }

    useEffect(() => {
        fetchClasses()
        fetchStudents()
    }, [])

    useEffect(() => {
        fetchStudents()
    }, [selectedClass])

    const handleAddStudent = async (formData: FormData) => {
        setIsLoading(true)
        const name = formData.get('name') as string
        const rollNo = formData.get('roll_no') as string
        const classId = formData.get('class_id') as string

        const { error } = await supabase.from('students').insert({
            full_name: name,
            roll_no: rollNo,
            class_id: classId
        })

        if (error) {
            alert(error.message)
        } else {
            setIsModalOpen(false)
            fetchStudents()
        }
        setIsLoading(false)
    }

    const handleDeleteStudent = async (id: string) => {
        // First delete related game_results to handle foreign key constraint
        await supabase.from('game_results').delete().eq('student_id', id)

        const { error } = await supabase.from('students').delete().eq('id', id)
        if (error) {
            alert(error.message)
        } else {
            fetchStudents()
        }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedStudents.length} students? This will also delete their game history and cannot be undone.`)) return

        // First delete related game_results for all selected students
        await supabase.from('game_results').delete().in('student_id', selectedStudents)

        const { error } = await supabase.from('students').delete().in('id', selectedStudents)
        if (error) {
            alert(error.message)
        } else {
            setSelectedStudents([])
            fetchStudents()
        }
    }

    const toggleAllStudents = () => {
        if (selectedStudents.length === students.length) {
            setSelectedStudents([])
        } else {
            setSelectedStudents(students.map(s => s.id))
        }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
                        Student Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage students and view their progress</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchStudents}
                        disabled={fetching}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/30"
                    >
                        <Plus className="w-5 h-5" />
                        Add Student
                    </button>
                </div>
            </div>

            {/* Class Filter Dropdown */}
            <div className="mb-6 flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
                <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none min-w-[200px]"
                >
                    <option value="">All Classes</option>
                    {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name} - {cls.section}</option>
                    ))}
                </select>
                {selectedClass && (
                    <button
                        onClick={() => setSelectedClass('')}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        Clear Filter
                    </button>
                )}
            </div>

            {/* Bulk Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
                <button
                    onClick={() => setShowBulkUpload(!showBulkUpload)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                    <div className="flex items-center gap-3">
                        <Upload className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-gray-700">Bulk Upload / Export Students (CSV)</span>
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
                                <CSVUploader type="students" onSuccess={fetchStudents} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bulk Edit Toolbar */}
            <AnimatePresence>
                {selectedStudents.length > 0 && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50"
                    >
                        <span className="font-medium">{selectedStudents.length} selected</span>
                        <div className="h-6 w-px bg-white/20"></div>
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected
                        </button>
                        <button
                            onClick={() => setSelectedStudents([])}
                            className="p-2 hover:bg-white/10 rounded-lg transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {fetching ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-500" />
                        Loading students...
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                                <tr>
                                    <th className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={students.length > 0 && selectedStudents.length === students.length}
                                            onChange={toggleAllStudents}
                                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                    </th>
                                    <th className="px-6 py-4">Roll No</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Class</th>
                                    <th className="px-6 py-4">Points</th>
                                    <th className="px-6 py-4">Level</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map((student) => (
                                    <motion.tr
                                        key={student.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`hover:bg-gray-50/50 transition ${selectedStudents.includes(student.id) ? 'bg-emerald-50' : ''}`}
                                    >
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedStudents.includes(student.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedStudents([...selectedStudents, student.id])
                                                    } else {
                                                        setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-500">{student.roll_no || '-'}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{student.full_name}</td>
                                        <td className="px-6 py-4">
                                            {student.classes ? `${student.classes.name} - ${student.classes.section}` : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-emerald-600">{student.total_points || 0}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs font-medium">
                                                Level {student.current_level || 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete ${student.full_name}?`)) {
                                                        handleDeleteStudent(student.id)
                                                    }
                                                }}
                                                className="text-red-500 hover:bg-red-50 p-2 rounded transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                        {students.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                <GraduationCap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No students found.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Student">
                <form action={handleAddStudent} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input name="name" type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="e.g. Rahul Sharma" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                        <input name="roll_no" type="text" className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="e.g. 101" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                        <select name="class_id" required className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500/50 outline-none">
                            <option value="">Select Class</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name} - {cls.section}</option>
                            ))}
                        </select>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                            {isLoading ? 'Adding...' : 'Add Student'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
