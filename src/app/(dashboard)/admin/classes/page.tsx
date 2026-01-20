'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, RefreshCw, Edit2, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

type ClassItem = {
    id: string
    name: string
    section: string
    created_at: string
    student_count?: number
}

export default function ClassesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [fetching, setFetching] = useState(true)
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
    const supabase = createClient()

    const fetchClasses = async () => {
        setFetching(true)
        const { data, error } = await supabase
            .from('classes')
            .select('id, name, section, created_at')
            .order('name', { ascending: true })

        if (data) {
            // Get student counts
            const classesWithCounts = await Promise.all(
                data.map(async (cls) => {
                    const { count } = await supabase
                        .from('students')
                        .select('*', { count: 'exact', head: true })
                        .eq('class_id', cls.id)
                    return { ...cls, student_count: count || 0 }
                })
            )
            setClasses(classesWithCounts)
        }
        setFetching(false)
    }

    useEffect(() => {
        fetchClasses()
    }, [])

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true)
        const name = formData.get('name') as string
        const section = formData.get('section') as string

        if (editingClass) {
            // Update
            const { error } = await supabase
                .from('classes')
                .update({ name, section })
                .eq('id', editingClass.id)
            if (error) alert(error.message)
        } else {
            // Create
            const { error } = await supabase
                .from('classes')
                .insert({ name, section })
            if (error) alert(error.message)
        }

        setIsLoading(false)
        setIsModalOpen(false)
        setEditingClass(null)
        fetchClasses()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this class? All associated students, subjects, topics, subtopics, and questions will be removed.')) return

        try {
            // First, get all subjects for this class
            const { data: subjects } = await supabase
                .from('subjects')
                .select('id')
                .eq('class_id', id)

            if (subjects && subjects.length > 0) {
                const subjectIds = subjects.map(s => s.id)

                // Get all topics for these subjects
                const { data: topics } = await supabase
                    .from('topics')
                    .select('id')
                    .in('subject_id', subjectIds)

                if (topics && topics.length > 0) {
                    const topicIds = topics.map(t => t.id)

                    // Get all subtopics for these topics
                    const { data: subtopics } = await supabase
                        .from('subtopics')
                        .select('id')
                        .in('topic_id', topicIds)

                    if (subtopics && subtopics.length > 0) {
                        const subtopicIds = subtopics.map(st => st.id)

                        // Delete questions linked to these subtopics
                        await supabase
                            .from('questions')
                            .delete()
                            .in('subtopic_id', subtopicIds)

                        // Delete subtopics
                        await supabase
                            .from('subtopics')
                            .delete()
                            .in('id', subtopicIds)
                    }

                    // Delete topics
                    await supabase
                        .from('topics')
                        .delete()
                        .in('id', topicIds)
                }

                // Delete subjects
                await supabase
                    .from('subjects')
                    .delete()
                    .in('id', subjectIds)
            }

            // Delete students in this class
            await supabase
                .from('students')
                .delete()
                .eq('class_id', id)

            // Finally delete the class
            const { error } = await supabase.from('classes').delete().eq('id', id)

            if (error) {
                alert('Error deleting class: ' + error.message)
            } else {
                fetchClasses()
            }
        } catch (err) {
            alert('Error during delete: ' + err)
        }
    }

    const openEditModal = (cls: ClassItem) => {
        setEditingClass(cls)
        setIsModalOpen(true)
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                        Class Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage classes and sections</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchClasses}
                        disabled={fetching}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => { setEditingClass(null); setIsModalOpen(true) }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                    >
                        <Plus className="w-5 h-5" />
                        Add Class
                    </button>
                </div>
            </div>

            {fetching ? (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
                    Loading classes...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.map((cls) => (
                        <motion.div
                            key={cls.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                                    <p className="text-gray-500">Section {cls.section}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEditModal(cls)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                                    >
                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cls.id)}
                                        className="p-2 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Users className="w-4 h-4" />
                                <span>{cls.student_count} students</span>
                            </div>
                        </motion.div>
                    ))}

                    {classes.length === 0 && (
                        <div className="col-span-full bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No classes found. Create one to get started.</p>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingClass(null) }}
                title={editingClass ? 'Edit Class' : 'Add New Class'}
            >
                <form action={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                        <input
                            name="name"
                            type="text"
                            required
                            defaultValue={editingClass?.name || ''}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                            placeholder="e.g. Class 10"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                        <input
                            name="section"
                            type="text"
                            required
                            defaultValue={editingClass?.section || ''}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/50 outline-none"
                            placeholder="e.g. A"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => { setIsModalOpen(false); setEditingClass(null) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isLoading ? 'Saving...' : editingClass ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
