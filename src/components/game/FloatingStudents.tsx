'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Student {
    id: string
    full_name: string
}

interface FloatingStudentsProps {
    students: Student[]
    selectedStudent: Student | null
    onStudentClick?: (student: Student) => void
    disabled?: boolean
}

// Generate a consistent color based on student name
function getAvatarColor(name: string): string {
    const colors = [
        'from-pink-500 to-rose-500',
        'from-purple-500 to-violet-500',
        'from-blue-500 to-cyan-500',
        'from-teal-500 to-emerald-500',
        'from-green-500 to-lime-500',
        'from-yellow-500 to-orange-500',
        'from-orange-500 to-red-500',
        'from-indigo-500 to-purple-500',
        'from-cyan-500 to-blue-500',
        'from-fuchsia-500 to-pink-500',
    ]

    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}

// Get initials from name
function getInitials(name: string): string {
    const parts = name.split(' ')
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
}

// Generate position in a grid layout on left/right sides (avoiding center wheel area 25-75%)
function generatePosition(index: number, total: number): { x: number; y: number; side: 'left' | 'right' } {
    const side = index % 2 === 0 ? 'left' : 'right'
    const halfIndex = Math.floor(index / 2)

    // Create rows - max 8 per column, then wrap to new column
    const maxPerColumn = 8
    const column = Math.floor(halfIndex / maxPerColumn)
    const row = halfIndex % maxPerColumn

    // Vertical spacing with padding
    const ySpacing = 85 / (Math.min(total / 2, maxPerColumn) + 1)
    const y = 8 + (row + 0.5) * ySpacing

    // Horizontal: left side columns (2-22%), right side columns (78-98%)
    // Each column is ~6% wide
    const xBase = side === 'left'
        ? 3 + column * 7
        : 93 - column * 7

    // Small random offset for natural look
    const xOffset = (Math.random() - 0.5) * 3
    const yOffset = (Math.random() - 0.5) * 4

    return {
        x: Math.max(1, Math.min(98, xBase + xOffset)),
        y: Math.max(5, Math.min(92, y + yOffset)),
        side
    }
}

export function FloatingStudents({ students, selectedStudent, onStudentClick, disabled }: FloatingStudentsProps) {
    const [hoveredStudent, setHoveredStudent] = useState<string | null>(null)
    const [bouncingStudent, setBouncingStudent] = useState<string | null>(null)

    // Generate stable positions for all students
    const studentPositions = useMemo(() => {
        return students.map((student, index) => ({
            ...student,
            ...generatePosition(index, students.length),
            color: getAvatarColor(student.full_name),
            initials: getInitials(student.full_name),
            animationDelay: index * 0.05,
            floatDuration: 2.5 + Math.random() * 1.5,
            floatDistance: 8 + Math.random() * 8,
            driftDistance: 3 + Math.random() * 5, // Horizontal drift
            driftDuration: 4 + Math.random() * 3,
        }))
    }, [students])

    // Handle balloon click - add bounce effect
    const handleBalloonClick = (student: Student) => {
        if (disabled) return
        setBouncingStudent(student.id)
        setTimeout(() => setBouncingStudent(null), 500)
        onStudentClick?.(student)
    }

    return (
        <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
            <AnimatePresence>
                {studentPositions.map((student) => {
                    const isSelected = selectedStudent?.id === student.id
                    const isHovered = hoveredStudent === student.id
                    const isBouncing = bouncingStudent === student.id

                    return (
                        <motion.div
                            key={student.id}
                            initial={{ opacity: 0, scale: 0, y: 50 }}
                            animate={{
                                opacity: isSelected ? 0.2 : 1,
                                scale: isSelected ? 0.4 : isBouncing ? 1.3 : 1,
                                y: 0
                            }}
                            exit={{ opacity: 0, scale: 0, y: -50 }}
                            transition={{
                                delay: student.animationDelay,
                                duration: 0.4,
                                type: 'spring',
                                stiffness: 300,
                                damping: 20
                            }}
                            className="absolute pointer-events-auto cursor-pointer"
                            style={{
                                left: `${student.x}%`,
                                top: `${student.y}%`,
                            }}
                            onClick={() => handleBalloonClick(student)}
                            onMouseEnter={() => setHoveredStudent(student.id)}
                            onMouseLeave={() => setHoveredStudent(null)}
                        >
                            {/* Floating + Drifting animation wrapper */}
                            <motion.div
                                animate={{
                                    y: [0, -student.floatDistance, 0],
                                    x: [-student.driftDistance / 2, student.driftDistance / 2, -student.driftDistance / 2],
                                    rotate: [-3, 3, -3]
                                }}
                                transition={{
                                    duration: student.floatDuration,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                }}
                                className="flex flex-col items-center"
                            >
                                {/* Balloon string */}
                                <svg
                                    width="2"
                                    height="24"
                                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-40"
                                >
                                    <path
                                        d="M1 0 Q0 8, 1.5 16 Q2 20, 1 24"
                                        stroke="white"
                                        fill="none"
                                        strokeWidth="1.5"
                                    />
                                </svg>

                                {/* Avatar balloon */}
                                <motion.div
                                    whileHover={{ scale: 1.25, rotate: 5 }}
                                    whileTap={{ scale: 0.9 }}
                                    className={`
                                        w-12 h-12 md:w-14 md:h-14 rounded-full 
                                        bg-gradient-to-br ${student.color}
                                        flex items-center justify-center
                                        shadow-lg shadow-black/30
                                        border-2 border-white/40
                                        relative overflow-hidden
                                        transition-all duration-200
                                        ${isHovered ? 'ring-4 ring-white/60 ring-offset-2 ring-offset-transparent' : ''}
                                        ${disabled ? 'opacity-40 grayscale' : ''}
                                    `}
                                >
                                    {/* Shine effect */}
                                    <div className="absolute top-1 left-2 w-3 h-3 bg-white/50 rounded-full blur-sm" />
                                    <div className="absolute top-2.5 left-3.5 w-1.5 h-1.5 bg-white/80 rounded-full" />

                                    {/* Initials */}
                                    <span className="text-white font-bold text-base md:text-lg drop-shadow-lg">
                                        {student.initials}
                                    </span>
                                </motion.div>

                                {/* Name label - always visible but more prominent on hover */}
                                <motion.div
                                    initial={{ opacity: 0.7 }}
                                    animate={{ opacity: isHovered ? 1 : 0.7, scale: isHovered ? 1.1 : 1 }}
                                    className={`
                                        mt-1.5 px-2 py-0.5 rounded-full
                                        bg-black/50 backdrop-blur-sm
                                        border border-white/20
                                    `}
                                >
                                    <span className="text-white text-[10px] md:text-xs font-medium whitespace-nowrap max-w-[80px] truncate block">
                                        {student.full_name.split(' ')[0]}
                                    </span>
                                </motion.div>

                                {/* Hover full name tooltip */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5, scale: 0.9 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 5, scale: 0.9 }}
                                            className="absolute -top-12 left-1/2 -translate-x-1/2 z-50"
                                        >
                                            <div className="px-3 py-1.5 bg-white text-gray-800 rounded-lg shadow-xl text-sm font-semibold whitespace-nowrap">
                                                {student.full_name}
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
