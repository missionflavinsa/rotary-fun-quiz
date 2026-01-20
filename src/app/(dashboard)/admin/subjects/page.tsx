'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, BookOpen, ChevronRight, Layers, Copy } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'

type ClassItem = { id: string; name: string; section: string }
type Subject = { id: string; name: string; class_id: string; classes?: ClassItem }
type Topic = { id: string; name: string; subject_id: string }
type Subtopic = { id: string; name: string; topic_id: string }

export default function SubjectsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalType, setModalType] = useState<'subject' | 'topic' | 'subtopic'>('subject')
    const [isLoading, setIsLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    const [classes, setClasses] = useState<ClassItem[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [subtopics, setSubtopics] = useState<Subtopic[]>([])

    const [selectedClass, setSelectedClass] = useState<string>('')
    const [selectedSubject, setSelectedSubject] = useState<string>('')
    const [selectedTopic, setSelectedTopic] = useState<string>('')
    const [selectedClassesForModal, setSelectedClassesForModal] = useState<string[]>([])

    // Copy From modal state
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
    const [copyType, setCopyType] = useState<'topic' | 'subtopic'>('topic')
    const [copySourceClass, setCopySourceClass] = useState<string>('')
    const [copySourceSubject, setCopySourceSubject] = useState<string>('')
    const [copySourceTopic, setCopySourceTopic] = useState<string>('')
    const [selectedTopicsToCopy, setSelectedTopicsToCopy] = useState<string[]>([])
    const [selectedSubtopicsToCopy, setSelectedSubtopicsToCopy] = useState<string[]>([])

    const supabase = createClient()

    const fetchData = async () => {
        setFetching(true)

        const [classesRes, subjectsRes, topicsRes, subtopicsRes] = await Promise.all([
            supabase.from('classes').select('id, name, section'),
            supabase.from('subjects').select('id, name, class_id, classes(name, section)'),
            supabase.from('topics').select('id, name, subject_id'),
            supabase.from('subtopics').select('id, name, topic_id')
        ])

        if (classesRes.data) setClasses(classesRes.data)
        if (subjectsRes.data) setSubjects(subjectsRes.data as unknown as Subject[])
        if (topicsRes.data) setTopics(topicsRes.data)
        if (subtopicsRes.data) setSubtopics(subtopicsRes.data)

        setFetching(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleAddSubject = async (formData: FormData) => {
        if (selectedClassesForModal.length === 0) {
            alert('Please select at least one class')
            return
        }
        setIsLoading(true)
        const name = formData.get('name') as string

        // Create a subject record for each selected class
        for (const classId of selectedClassesForModal) {
            const { error } = await supabase.from('subjects').insert({ name, class_id: classId })
            if (error) {
                console.error('Error adding subject:', error.message)
            }
        }

        setIsLoading(false)
        setIsModalOpen(false)
        setSelectedClassesForModal([])
        fetchData()
    }

    const handleAddTopic = async (formData: FormData) => {
        setIsLoading(true)
        const name = formData.get('name') as string
        const subjectId = formData.get('subject_id') as string

        const { error } = await supabase.from('topics').insert({ name, subject_id: subjectId })
        if (error) alert(error.message)

        setIsLoading(false)
        setIsModalOpen(false)
        fetchData()
    }

    const handleAddSubtopic = async (formData: FormData) => {
        setIsLoading(true)
        const name = formData.get('name') as string
        const topicId = formData.get('topic_id') as string

        const { error } = await supabase.from('subtopics').insert({ name, topic_id: topicId })
        if (error) alert(error.message)

        setIsLoading(false)
        setIsModalOpen(false)
        fetchData()
    }

    const handleDelete = async (table: string, id: string) => {
        if (!confirm(`Delete this ${table.slice(0, -1)}?`)) return
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) alert(error.message)
        fetchData()
    }

    const openModal = (type: 'subject' | 'topic' | 'subtopic') => {
        setModalType(type)
        setSelectedClassesForModal([])
        setIsModalOpen(true)
    }

    // Open Copy Modal
    const openCopyModal = (type: 'topic' | 'subtopic') => {
        setCopyType(type)
        setCopySourceClass('')
        setCopySourceSubject('')
        setCopySourceTopic('')
        setSelectedTopicsToCopy([])
        setSelectedSubtopicsToCopy([])
        setIsCopyModalOpen(true)
    }

    // Handle Copy Topics (with their subtopics - LINK questions, don't duplicate)
    const handleCopyTopics = async () => {
        if (!selectedSubject || selectedTopicsToCopy.length === 0) {
            alert('Please select target subject and topics to copy')
            return
        }
        setIsLoading(true)

        // Get target class ID for linking questions
        const targetSubject = subjects.find(s => s.id === selectedSubject)
        const targetClassId = targetSubject?.class_id

        for (const topicId of selectedTopicsToCopy) {
            const sourceTopic = topics.find(t => t.id === topicId)
            if (!sourceTopic) continue

            // Insert new topic
            const { data: newTopic, error: topicError } = await supabase
                .from('topics')
                .insert({ name: sourceTopic.name, subject_id: selectedSubject })
                .select('id')
                .single()

            if (topicError) {
                console.error('Error copying topic:', topicError.message)
                continue
            }

            // Copy all subtopics from source topic
            const sourceSubtopics = subtopics.filter(s => s.topic_id === topicId)
            for (const sub of sourceSubtopics) {
                // Insert new subtopic
                const { data: newSubtopic, error: subtopicError } = await supabase
                    .from('subtopics')
                    .insert({ name: sub.name, topic_id: newTopic.id })
                    .select('id')
                    .single()

                if (subtopicError) {
                    console.error('Error copying subtopic:', subtopicError.message)
                    continue
                }

                // Link questions to target class (don't duplicate questions)
                if (targetClassId) {
                    const { data: sourceQuestions } = await supabase
                        .from('questions')
                        .select('id')
                        .eq('subtopic_id', sub.id)

                    if (sourceQuestions && sourceQuestions.length > 0) {
                        const linksToInsert = sourceQuestions.map(q => ({
                            question_id: q.id,
                            class_id: targetClassId
                        }))
                        // Upsert to handle duplicates
                        await supabase.from('question_class_links').upsert(linksToInsert, { onConflict: 'question_id,class_id' })
                    }
                }
            }
        }

        setIsLoading(false)
        setIsCopyModalOpen(false)
        fetchData()
    }

    // Handle Copy Subtopics (LINK questions, don't duplicate)
    const handleCopySubtopics = async () => {
        if (!selectedTopic || selectedSubtopicsToCopy.length === 0) {
            alert('Please select target topic and subtopics to copy')
            return
        }
        setIsLoading(true)

        // Get the target topic's subject and class for linking
        const targetTopic = topics.find(t => t.id === selectedTopic)
        const targetSubject = subjects.find(s => s.id === targetTopic?.subject_id)
        const targetClassId = targetSubject?.class_id

        for (const subtopicId of selectedSubtopicsToCopy) {
            const sourceSubtopic = subtopics.find(s => s.id === subtopicId)
            if (!sourceSubtopic) continue

            // Insert new subtopic
            const { data: newSubtopic, error: subtopicError } = await supabase
                .from('subtopics')
                .insert({ name: sourceSubtopic.name, topic_id: selectedTopic })
                .select('id')
                .single()

            if (subtopicError) {
                console.error('Error copying subtopic:', subtopicError.message)
                continue
            }

            // Link questions to target class (don't duplicate questions)
            if (targetClassId) {
                const { data: sourceQuestions } = await supabase
                    .from('questions')
                    .select('id')
                    .eq('subtopic_id', subtopicId)

                if (sourceQuestions && sourceQuestions.length > 0) {
                    const linksToInsert = sourceQuestions.map(q => ({
                        question_id: q.id,
                        class_id: targetClassId
                    }))
                    // Upsert to handle duplicates
                    await supabase.from('question_class_links').upsert(linksToInsert, { onConflict: 'question_id,class_id' })
                }
            }
        }

        setIsLoading(false)
        setIsCopyModalOpen(false)
        fetchData()
    }

    const filteredSubjects = selectedClass
        ? subjects.filter(s => s.class_id === selectedClass)
        : subjects

    const filteredTopics = selectedSubject
        ? topics.filter(t => t.subject_id === selectedSubject)
        : []

    const filteredSubtopics = selectedTopic
        ? subtopics.filter(s => s.topic_id === selectedTopic)
        : []

    // For copy modal - get available items based on source selection
    const copySourceSubjects = copySourceClass
        ? subjects.filter(s => s.class_id === copySourceClass)
        : []

    const copySourceTopics = copySourceSubject
        ? topics.filter(t => t.subject_id === copySourceSubject)
        : []

    const copySourceSubtopics = copySourceTopic
        ? subtopics.filter(s => s.topic_id === copySourceTopic)
        : []

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-pink-600">
                        Subjects & Topics
                    </h1>
                    <p className="text-gray-500 mt-1">Manage curriculum hierarchy</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={fetching}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                >
                    <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Subjects Column */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-pink-50">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-orange-600" />
                            <h2 className="font-bold text-gray-900">Subjects</h2>
                        </div>
                        <button
                            onClick={() => openModal('subject')}
                            className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-2 border-b">
                        <select
                            value={selectedClass}
                            onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); setSelectedTopic('') }}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                        >
                            <option value="">All Classes</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                            ))}
                        </select>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                        {filteredSubjects.map(subj => (
                            <div
                                key={subj.id}
                                onClick={() => { setSelectedSubject(subj.id); setSelectedTopic('') }}
                                className={`p-3 cursor-pointer flex justify-between items-center transition ${selectedSubject === subj.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div>
                                    <p className="font-medium text-gray-900">{subj.name}</p>
                                    <p className="text-xs text-gray-500">{subj.classes?.name} - {subj.classes?.section}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('subjects', subj.id) }} className="p-1 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        ))}
                        {filteredSubjects.length === 0 && (
                            <p className="p-4 text-center text-gray-500 text-sm">No subjects found</p>
                        )}
                    </div>
                </div>

                {/* Topics Column */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-indigo-50">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-purple-600" />
                            <h2 className="font-bold text-gray-900">Topics</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openCopyModal('topic')}
                                disabled={!selectedSubject}
                                className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Copy topics from another subject"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => openModal('topic')}
                                disabled={!selectedSubject}
                                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
                        {selectedSubject ? (
                            filteredTopics.length > 0 ? (
                                filteredTopics.map(topic => (
                                    <div
                                        key={topic.id}
                                        onClick={() => setSelectedTopic(topic.id)}
                                        className={`p-3 cursor-pointer flex justify-between items-center transition ${selectedTopic === topic.id ? 'bg-purple-50' : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <p className="font-medium text-gray-900">{topic.name}</p>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete('topics', topic.id) }} className="p-1 hover:bg-red-50 rounded">
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="p-4 text-center text-gray-500 text-sm">No topics. Add one!</p>
                            )
                        ) : (
                            <p className="p-4 text-center text-gray-500 text-sm">← Select a subject first</p>
                        )}
                    </div>
                </div>

                {/* Subtopics Column */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-cyan-50 to-blue-50">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-cyan-600" />
                            <h2 className="font-bold text-gray-900">Subtopics</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openCopyModal('subtopic')}
                                disabled={!selectedTopic}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Copy subtopics from another topic"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => openModal('subtopic')}
                                disabled={!selectedTopic}
                                className="p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
                        {selectedTopic ? (
                            filteredSubtopics.length > 0 ? (
                                filteredSubtopics.map(sub => (
                                    <div key={sub.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition">
                                        <p className="font-medium text-gray-900">{sub.name}</p>
                                        <button onClick={() => handleDelete('subtopics', sub.id)} className="p-1 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="p-4 text-center text-gray-500 text-sm">No subtopics. Add one!</p>
                            )
                        ) : (
                            <p className="p-4 text-center text-gray-500 text-sm">← Select a topic first</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Add ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}
            >
                {modalType === 'subject' && (
                    <form action={handleAddSubject} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Classes <span className="text-gray-500">(multiple allowed)</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                {classes.map(c => (
                                    <label
                                        key={c.id}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedClassesForModal.includes(c.id)
                                            ? 'bg-orange-50 border border-orange-200'
                                            : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedClassesForModal.includes(c.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedClassesForModal([...selectedClassesForModal, c.id])
                                                } else {
                                                    setSelectedClassesForModal(selectedClassesForModal.filter(id => id !== c.id))
                                                }
                                            }}
                                            className="w-4 h-4 text-orange-600 rounded border-gray-300"
                                        />
                                        <span className="text-gray-900">{c.name} - {c.section}</span>
                                    </label>
                                ))}
                            </div>
                            {selectedClassesForModal.length > 0 && (
                                <p className="text-xs text-orange-600 mt-1">
                                    {selectedClassesForModal.length} class(es) selected - will create {selectedClassesForModal.length} subject record(s)
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                            <input name="name" type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-200" placeholder="e.g. Mathematics" />
                        </div>
                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button type="submit" disabled={isLoading || selectedClassesForModal.length === 0} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                                {isLoading ? 'Adding...' : `Add to ${selectedClassesForModal.length || 0} Class(es)`}
                            </button>
                        </div>
                    </form>
                )}
                {modalType === 'topic' && (
                    <form action={handleAddTopic} className="space-y-4">
                        <input type="hidden" name="subject_id" value={selectedSubject} />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Topic Name</label>
                            <input name="name" type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-200" placeholder="e.g. Algebra" />
                        </div>
                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                                {isLoading ? 'Adding...' : 'Add Topic'}
                            </button>
                        </div>
                    </form>
                )}
                {modalType === 'subtopic' && (
                    <form action={handleAddSubtopic} className="space-y-4">
                        <input type="hidden" name="topic_id" value={selectedTopic} />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subtopic Name</label>
                            <input name="name" type="text" required className="w-full px-4 py-2 rounded-lg border border-gray-200" placeholder="e.g. Polynomials" />
                        </div>
                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">
                                {isLoading ? 'Adding...' : 'Add Subtopic'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Copy From Modal */}
            <Modal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                title={`Copy ${copyType === 'topic' ? 'Topics' : 'Subtopics'} From Another ${copyType === 'topic' ? 'Subject' : 'Topic'}`}
            >
                <div className="space-y-4">
                    {/* Info banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                        {copyType === 'topic' ? (
                            <p>Select topics from another subject to copy them (along with their subtopics) to the currently selected subject.</p>
                        ) : (
                            <p>Select subtopics from another topic to copy them to the currently selected topic.</p>
                        )}
                    </div>

                    {/* Step 1: Select Source Class */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">1. Select Source Class</label>
                        <select
                            value={copySourceClass}
                            onChange={(e) => {
                                setCopySourceClass(e.target.value)
                                setCopySourceSubject('')
                                setCopySourceTopic('')
                                setSelectedTopicsToCopy([])
                                setSelectedSubtopicsToCopy([])
                            }}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200"
                        >
                            <option value="">Select a class...</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Select Source Subject */}
                    {copySourceClass && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">2. Select Source Subject</label>
                            <select
                                value={copySourceSubject}
                                onChange={(e) => {
                                    setCopySourceSubject(e.target.value)
                                    setCopySourceTopic('')
                                    setSelectedTopicsToCopy([])
                                    setSelectedSubtopicsToCopy([])
                                }}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200"
                            >
                                <option value="">Select a subject...</option>
                                {copySourceSubjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* For copying topics - show topics to select */}
                    {copyType === 'topic' && copySourceSubject && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">3. Select Topics to Copy</label>
                            {copySourceTopics.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                    {copySourceTopics.map(topic => {
                                        const topicSubtopics = subtopics.filter(s => s.topic_id === topic.id)
                                        return (
                                            <label
                                                key={topic.id}
                                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedTopicsToCopy.includes(topic.id)
                                                    ? 'bg-purple-50 border border-purple-200'
                                                    : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTopicsToCopy.includes(topic.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedTopicsToCopy([...selectedTopicsToCopy, topic.id])
                                                        } else {
                                                            setSelectedTopicsToCopy(selectedTopicsToCopy.filter(id => id !== topic.id))
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300"
                                                />
                                                <div>
                                                    <span className="text-gray-900 font-medium">{topic.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">({topicSubtopics.length} subtopic{topicSubtopics.length !== 1 ? 's' : ''})</span>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">No topics available in this subject</p>
                            )}
                            {selectedTopicsToCopy.length > 0 && (
                                <p className="text-xs text-purple-600 mt-1">
                                    {selectedTopicsToCopy.length} topic(s) selected - subtopics will also be copied
                                </p>
                            )}
                        </div>
                    )}

                    {/* For copying subtopics - show source topic, then subtopics */}
                    {copyType === 'subtopic' && copySourceSubject && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">3. Select Source Topic</label>
                                <select
                                    value={copySourceTopic}
                                    onChange={(e) => {
                                        setCopySourceTopic(e.target.value)
                                        setSelectedSubtopicsToCopy([])
                                    }}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200"
                                >
                                    <option value="">Select a topic...</option>
                                    {copySourceTopics.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {copySourceTopic && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">4. Select Subtopics to Copy</label>
                                    {copySourceSubtopics.length > 0 ? (
                                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                            {copySourceSubtopics.map(subtopic => (
                                                <label
                                                    key={subtopic.id}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedSubtopicsToCopy.includes(subtopic.id)
                                                        ? 'bg-cyan-50 border border-cyan-200'
                                                        : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSubtopicsToCopy.includes(subtopic.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedSubtopicsToCopy([...selectedSubtopicsToCopy, subtopic.id])
                                                            } else {
                                                                setSelectedSubtopicsToCopy(selectedSubtopicsToCopy.filter(id => id !== subtopic.id))
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-cyan-600 rounded border-gray-300"
                                                    />
                                                    <span className="text-gray-900">{subtopic.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-sm">No subtopics available in this topic</p>
                                    )}
                                    {selectedSubtopicsToCopy.length > 0 && (
                                        <p className="text-xs text-cyan-600 mt-1">
                                            {selectedSubtopicsToCopy.length} subtopic(s) selected
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Action buttons */}
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCopyModalOpen(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={copyType === 'topic' ? handleCopyTopics : handleCopySubtopics}
                            disabled={isLoading || (copyType === 'topic' ? selectedTopicsToCopy.length === 0 : selectedSubtopicsToCopy.length === 0)}
                            className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${copyType === 'topic'
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-cyan-600 hover:bg-cyan-700'
                                }`}
                        >
                            {isLoading ? 'Copying...' : `Copy ${copyType === 'topic' ? selectedTopicsToCopy.length : selectedSubtopicsToCopy.length} ${copyType}(s)`}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
