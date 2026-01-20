'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface StudentSegment {
    id: string
    name: string
}

interface SpinningWheelProps {
    segments: StudentSegment[]
    onSpinEnd: (winner: { id: string; name: string }) => void
    spinning: boolean
    setSpinning: (val: boolean) => void
    autoSpin?: boolean // When true, automatically trigger spin
}

const COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#f97316', '#eab308',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
]

function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function SpinningWheel({ segments, onSpinEnd, spinning, setSpinning, autoSpin }: SpinningWheelProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rotationRef = useRef(0)
    const [winner, setWinner] = useState<StudentSegment | null>(null)
    const requestRef = useRef<number>((null as unknown) as number)
    const startTimeRef = useRef<number>(0)
    const spinDurationRef = useRef<number>(5000)
    const targetRotationRef = useRef(0)
    const startRotationRef = useRef(0)

    // Easing function for realistic spin
    const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3)
    }

    // Draw the wheel
    const drawWheel = useCallback((rotation: number) => {
        const canvas = canvasRef.current
        if (!canvas || segments.length === 0) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const size = canvas.width
        const center = size / 2
        const radius = size / 2 - 15
        const arc = (Math.PI * 2) / segments.length

        ctx.clearRect(0, 0, size, size)

        // Save context and apply rotation
        ctx.save()
        ctx.translate(center, center)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.translate(-center, -center)

        // Draw outer glow ring
        const glowGradient = ctx.createRadialGradient(center, center, radius - 20, center, center, radius + 20)
        glowGradient.addColorStop(0, 'transparent')
        glowGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)')
        glowGradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(center, center, radius + 10, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()

        // Draw segments - clean colorful wheel without names
        segments.forEach((seg, i) => {
            const startAngle = i * arc - Math.PI / 2
            const endAngle = startAngle + arc
            const color = COLORS[i % COLORS.length]

            // Draw segment
            ctx.beginPath()
            ctx.moveTo(center, center)
            ctx.arc(center, center, radius, startAngle, endAngle)
            ctx.closePath()

            // Gradient fill for each segment
            const segGradient = ctx.createRadialGradient(center, center, 0, center, center, radius)
            segGradient.addColorStop(0, lightenColor(color, 20))
            segGradient.addColorStop(0.4, color)
            segGradient.addColorStop(1, adjustColor(color, -30))
            ctx.fillStyle = segGradient
            ctx.fill()

            // Segment border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
            ctx.lineWidth = 3
            ctx.stroke()

            // Decorative inner arc pattern
            ctx.save()
            ctx.translate(center, center)
            ctx.rotate(startAngle + arc / 2)

            // Decorative shine line
            ctx.beginPath()
            ctx.moveTo(radius * 0.3, 0)
            ctx.lineTo(radius * 0.85, 0)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
            ctx.lineWidth = 8
            ctx.lineCap = 'round'
            ctx.stroke()

            // Small decorative circles
            ctx.beginPath()
            ctx.arc(radius * 0.6, 0, 6, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
            ctx.fill()

            ctx.restore()
        })

        // Draw decorative outer ring
        ctx.beginPath()
        ctx.arc(center, center, radius, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = 4
        ctx.stroke()

        // Draw center hub
        const hubGradient = ctx.createRadialGradient(center, center, 0, center, center, 45)
        hubGradient.addColorStop(0, '#4338ca')
        hubGradient.addColorStop(0.5, '#312e81')
        hubGradient.addColorStop(1, '#1e1b4b')
        ctx.beginPath()
        ctx.arc(center, center, 45, 0, Math.PI * 2)
        ctx.fillStyle = hubGradient
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 3
        ctx.stroke()

        // Center emoji
        ctx.font = '28px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'transparent'
        ctx.fillText('🎯', center, center)

        ctx.restore()
    }, [segments])

    const calculateWinner = (finalRotation: number) => {
        const arc = 360 / segments.length
        // Normalize and adjust for pointer at top
        const normalizedAngle = ((360 - (finalRotation % 360)) + 90) % 360
        const winnerIndex = Math.floor(normalizedAngle / arc) % segments.length
        const selectedWinner = segments[winnerIndex]

        setWinner(selectedWinner)
        setSpinning(false)
        onSpinEnd(selectedWinner)
    }

    const animate = useCallback((time: number) => {
        if (spinning) {
            if (startTimeRef.current === 0) {
                startTimeRef.current = time
            }
            const elapsed = time - startTimeRef.current
            const progress = Math.min(elapsed / spinDurationRef.current, 1)
            const easedProgress = easeOutCubic(progress)

            const current = startRotationRef.current + (targetRotationRef.current - startRotationRef.current) * easedProgress
            rotationRef.current = current
            drawWheel(current)

            if (progress < 1) {
                requestRef.current = requestAnimationFrame(animate)
            } else {
                calculateWinner(targetRotationRef.current)
                // Don't restart loop immediately, let it sit on winner
            }
        } else if (!winner) {
            // Idle animation
            rotationRef.current = (rotationRef.current + 0.2) % 360
            drawWheel(rotationRef.current)
            requestRef.current = requestAnimationFrame(animate)
        }
    }, [spinning, winner, drawWheel])

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(requestRef.current)
    }, [animate])

    // Auto-spin when autoSpin prop becomes true
    useEffect(() => {
        if (autoSpin && !spinning && segments.length > 0) {
            // Trigger spin with small delay to ensure UI is ready
            const timer = setTimeout(() => {
                setSpinning(true)
                setWinner(null)
                startTimeRef.current = 0
                startRotationRef.current = rotationRef.current

                // Random spin: 5-10 full rotations + random angle
                const spins = 5 + Math.random() * 5
                const randomAngle = Math.random() * 360
                const newTarget = rotationRef.current + spins * 360 + randomAngle

                spinDurationRef.current = 4000 + Math.random() * 2000
                targetRotationRef.current = newTarget
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [autoSpin, spinning, segments.length])

    const spinWheel = () => {
        if (spinning || segments.length === 0) return

        setSpinning(true)
        setWinner(null)
        startTimeRef.current = 0
        startRotationRef.current = rotationRef.current

        // Random spin: 5-10 full rotations + random angle
        const spins = 5 + Math.random() * 5
        const randomAngle = Math.random() * 360
        const newTarget = rotationRef.current + spins * 360 + randomAngle

        spinDurationRef.current = 4000 + Math.random() * 2000 // 4-6 seconds
        targetRotationRef.current = newTarget
    }

    return (
        <div className="relative flex flex-col items-center">
            {/* Decorative outer lights */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[...Array(16)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2.5 h-2.5 rounded-full"
                        style={{
                            backgroundColor: spinning ? (i % 2 === 0 ? '#fbbf24' : '#fff') : '#fbbf24',
                            transform: `rotate(${i * 22.5}deg) translateY(-215px)`,
                            boxShadow: '0 0 8px rgba(251, 191, 36, 0.8)'
                        }}
                        animate={{
                            opacity: spinning ? [0.3, 1, 0.3] : 0.8,
                            scale: spinning ? [0.8, 1.2, 0.8] : 1
                        }}
                        transition={{
                            duration: 0.3,
                            repeat: spinning ? Infinity : 0,
                            delay: i * 0.05
                        }}
                    />
                ))}
            </div>

            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                <motion.div
                    animate={spinning ? {
                        y: [0, -8, 0],
                        rotateZ: [-2, 2, -2]
                    } : {}}
                    transition={{
                        duration: 0.15,
                        repeat: spinning ? Infinity : 0,
                        ease: 'easeInOut'
                    }}
                >
                    <svg width="50" height="60" viewBox="0 0 50 60">
                        <defs>
                            <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#fbbf24" />
                                <stop offset="50%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#d97706" />
                            </linearGradient>
                            <filter id="pointerShadow">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.4" />
                            </filter>
                        </defs>
                        <polygon
                            points="25,55 5,5 45,5"
                            fill="url(#pointerGrad)"
                            filter="url(#pointerShadow)"
                            stroke="#fff"
                            strokeWidth="2"
                        />
                        <circle cx="25" cy="15" r="6" fill="#fff" opacity="0.5" />
                    </svg>
                </motion.div>
            </div>

            {/* Wheel Container */}
            <div className="relative mt-4">
                <canvas
                    ref={canvasRef}
                    width={420}
                    height={420}
                    className="drop-shadow-2xl"
                />

                {/* Inner glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl -z-10 scale-125"></div>
            </div>

            {/* Spin Button */}
            <motion.button
                onClick={spinWheel}
                disabled={spinning || segments.length === 0}
                whileHover={{ scale: spinning ? 1 : 1.05 }}
                whileTap={{ scale: spinning ? 1 : 0.95 }}
                className={`mt-10 px-14 py-5 rounded-full font-bold text-xl transition-all ${spinning
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 shadow-2xl shadow-orange-500/40'
                    }`}
            >
                {spinning ? (
                    <span className="flex items-center gap-3">
                        <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                        >
                            🎡
                        </motion.span>
                        <span>Spinning...</span>
                    </span>
                ) : (
                    <span className="flex items-center gap-3">
                        🎯 SPIN THE WHEEL!
                    </span>
                )}
            </motion.button>

            {/* Winner Announcement */}
            <AnimatePresence>
                {winner && !spinning && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: 'spring', damping: 12 }}
                        className="mt-10"
                    >
                        <div className="relative">
                            {/* Confetti effect */}
                            <div className="absolute -inset-8 pointer-events-none">
                                {[...Array(8)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute text-2xl"
                                        style={{
                                            left: `${10 + i * 12}%`,
                                            top: '-20px'
                                        }}
                                        animate={{
                                            y: [0, 20, 0],
                                            rotate: [0, 180, 360],
                                            opacity: [0.8, 1, 0.8]
                                        }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            delay: i * 0.15
                                        }}
                                    >
                                        {['✨', '🎉', '⭐', '🌟'][i % 4]}
                                    </motion.div>
                                ))}
                            </div>

                            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white px-12 py-8 rounded-3xl shadow-2xl shadow-green-500/40">
                                <div className="flex items-center gap-5">
                                    {/* Avatar */}
                                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold border-4 border-white/30">
                                        {getInitials(winner.name)}
                                    </div>
                                    <div>
                                        <p className="text-sm uppercase tracking-wider opacity-80 mb-1">🎉 Selected Student</p>
                                        <p className="text-4xl font-bold">{winner.name}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Helper to adjust color brightness
function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount))
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount))
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount))
    return `rgb(${r}, ${g}, ${b})`
}

// Helper to lighten color
function lightenColor(color: string, amount: number): string {
    const hex = color.replace('#', '')
    const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + amount)
    const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + amount)
    const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + amount)
    return `rgb(${r}, ${g}, ${b})`
}
