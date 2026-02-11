'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

function getInitials(name: string): string {
    const parts = name.split(' ')
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
}

// Generate a random position anywhere on screen, avoiding the center wheel area
function randomScreenPos(): { x: number; y: number } {
    // Full screen range: x 1-99%, y 3-95%
    // Avoid center wheel area roughly x: 30-70%, y: 5-75%
    let x: number, y: number
    const attempt = Math.random()

    if (attempt < 0.5) {
        // Left side: x 1-28%
        x = 1 + Math.random() * 27
        y = 3 + Math.random() * 92
    } else {
        // Right side: x 72-99%
        x = 72 + Math.random() * 27
        y = 3 + Math.random() * 92
    }

    // Occasionally allow top/bottom crossing through center
    if (Math.random() < 0.3) {
        x = 5 + Math.random() * 90 // full width
        if (Math.random() < 0.5) {
            y = 78 + Math.random() * 17 // below wheel
        } else {
            y = 3 + Math.random() * 5 // above wheel (narrow top band)
        }
    }

    return { x, y }
}

interface BalloonState {
    student: Student
    color: string
    initials: string
    // Current target position (animated to)
    targetX: number
    targetY: number
    // Animation duration for this leg
    duration: number
    // Rotation
    rotate: number
}

export function FloatingStudents({ students, selectedStudent, onStudentClick, disabled }: FloatingStudentsProps) {
    const [hoveredStudent, setHoveredStudent] = useState<string | null>(null)
    const [bouncingStudent, setBouncingStudent] = useState<string | null>(null)
    const [balloons, setBalloons] = useState<BalloonState[]>([])
    const intervalsRef = useRef<NodeJS.Timeout[]>([])

    // Initialize balloons with random positions
    useEffect(() => {
        const initial: BalloonState[] = students.map((student) => {
            const pos = randomScreenPos()
            return {
                student,
                color: getAvatarColor(student.full_name),
                initials: getInitials(student.full_name),
                targetX: pos.x,
                targetY: pos.y,
                duration: 6 + Math.random() * 6,
                rotate: (Math.random() - 0.5) * 10,
            }
        })
        setBalloons(initial)

        // Clear old intervals
        intervalsRef.current.forEach(clearInterval)
        intervalsRef.current = []

        // Each balloon gets its own interval to pick a new random destination
        const newIntervals = students.map((_, idx) => {
            // Stagger the first move
            const firstDelay = 3000 + Math.random() * 5000
            const moveInterval = 5000 + Math.random() * 7000 // 5-12s between moves

            const timeout = setTimeout(() => {
                // First move
                setBalloons(prev => {
                    const next = [...prev]
                    if (next[idx]) {
                        const pos = randomScreenPos()
                        next[idx] = {
                            ...next[idx],
                            targetX: pos.x,
                            targetY: pos.y,
                            duration: 6 + Math.random() * 8,
                            rotate: (Math.random() - 0.5) * 15,
                        }
                    }
                    return next
                })

                // Then keep moving periodically
                const interval = setInterval(() => {
                    setBalloons(prev => {
                        const next = [...prev]
                        if (next[idx]) {
                            const pos = randomScreenPos()
                            next[idx] = {
                                ...next[idx],
                                targetX: pos.x,
                                targetY: pos.y,
                                duration: 6 + Math.random() * 8,
                                rotate: (Math.random() - 0.5) * 15,
                            }
                        }
                        return next
                    })
                }, moveInterval)

                intervalsRef.current.push(interval)
            }, firstDelay)

            return timeout as unknown as NodeJS.Timeout
        })

        intervalsRef.current.push(...newIntervals)

        return () => {
            intervalsRef.current.forEach(clearInterval)
            intervalsRef.current = []
        }
    }, [students])

    const handleBalloonClick = useCallback((student: Student) => {
        if (disabled) return
        setBouncingStudent(student.id)
        setTimeout(() => setBouncingStudent(null), 500)
        onStudentClick?.(student)
    }, [disabled, onStudentClick])

    return (
        <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
            <AnimatePresence>
                {balloons.map((balloon) => {
                    const isSelected = selectedStudent?.id === balloon.student.id
                    const isHovered = hoveredStudent === balloon.student.id
                    const isBouncing = bouncingStudent === balloon.student.id

                    return (
                        <motion.div
                            key={balloon.student.id}
                            initial={{
                                left: `${balloon.targetX}%`,
                                top: `${balloon.targetY}%`,
                                opacity: 0,
                                scale: 0,
                            }}
                            animate={{
                                left: `${balloon.targetX}%`,
                                top: `${balloon.targetY}%`,
                                opacity: isSelected ? 0.2 : 1,
                                scale: isSelected ? 0.4 : isBouncing ? 1.3 : 1,
                                rotate: balloon.rotate,
                            }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{
                                left: { duration: balloon.duration, ease: 'easeInOut' },
                                top: { duration: balloon.duration, ease: 'easeInOut' },
                                rotate: { duration: balloon.duration, ease: 'easeInOut' },
                                opacity: { duration: 0.4 },
                                scale: { duration: 0.3, type: 'spring', stiffness: 300, damping: 20 },
                            }}
                            className="absolute pointer-events-auto cursor-pointer"
                            style={{ willChange: 'left, top' }}
                            onClick={() => handleBalloonClick(balloon.student)}
                            onMouseEnter={() => setHoveredStudent(balloon.student.id)}
                            onMouseLeave={() => setHoveredStudent(null)}
                        >
                            <div className="flex flex-col items-center">
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
                                        bg-gradient-to-br ${balloon.color}
                                        flex items-center justify-center
                                        shadow-lg shadow-black/30
                                        border-2 border-white/40
                                        relative overflow-hidden
                                        transition-colors duration-200
                                        ${isHovered ? 'ring-4 ring-white/60 ring-offset-2 ring-offset-transparent' : ''}
                                        ${disabled ? 'opacity-40 grayscale' : ''}
                                    `}
                                >
                                    <div className="absolute top-1 left-2 w-3 h-3 bg-white/50 rounded-full blur-sm" />
                                    <div className="absolute top-2.5 left-3.5 w-1.5 h-1.5 bg-white/80 rounded-full" />
                                    <span className="text-white font-bold text-base md:text-lg drop-shadow-lg">
                                        {balloon.initials}
                                    </span>
                                </motion.div>

                                {/* Name label */}
                                <motion.div
                                    animate={{ opacity: isHovered ? 1 : 0.7, scale: isHovered ? 1.1 : 1 }}
                                    className="mt-1.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/20"
                                >
                                    <span className="text-white text-[10px] md:text-xs font-medium whitespace-nowrap max-w-[80px] truncate block">
                                        {balloon.student.full_name.split(' ')[0]}
                                    </span>
                                </motion.div>

                                {/* Hover tooltip */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5, scale: 0.9 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 5, scale: 0.9 }}
                                            className="absolute -top-12 left-1/2 -translate-x-1/2 z-50"
                                        >
                                            <div className="px-3 py-1.5 bg-white text-gray-800 rounded-lg shadow-xl text-sm font-semibold whitespace-nowrap">
                                                {balloon.student.full_name}
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
