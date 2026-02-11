'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import { verifyGameCode, generateGameCode } from '@/lib/gameCode'

interface GameCodeModalProps {
    isOpen: boolean
    onSuccess: () => void
    onClose: () => void
}

export function GameCodeModal({ isOpen, onSuccess, onClose }: GameCodeModalProps) {
    const [code, setCode] = useState(['', '', '', ''])
    const [error, setError] = useState('')
    const [verifying, setVerifying] = useState(false)
    const [success, setSuccess] = useState(false)
    const [expiresIn, setExpiresIn] = useState(60)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Update timer
    useEffect(() => {
        if (!isOpen) return

        const updateTimer = () => {
            const { expiresIn: exp } = generateGameCode()
            setExpiresIn(exp)
        }
        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [isOpen])

    // Focus first input when modal opens
    useEffect(() => {
        if (isOpen) {
            setCode(['', '', '', ''])
            setError('')
            setSuccess(false)
            setTimeout(() => inputRefs.current[0]?.focus(), 100)
        }
    }, [isOpen])

    const handleDigitChange = (index: number, value: string) => {
        // Only allow numbers
        if (value && !/^\d$/.test(value)) return

        const newCode = [...code]
        newCode[index] = value
        setCode(newCode)
        setError('')

        // Auto-focus next input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus()
        }

        // Auto-verify when all digits entered
        if (value && index === 3 && newCode.every(d => d !== '')) {
            verifyCode(newCode.join(''))
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
        if (pastedData.length === 4) {
            const newCode = pastedData.split('')
            setCode(newCode)
            verifyCode(pastedData)
        }
    }

    const verifyCode = async (fullCode: string) => {
        setVerifying(true)
        setError('')

        // Small delay for UX
        await new Promise(resolve => setTimeout(resolve, 500))

        if (verifyGameCode(fullCode)) {
            setSuccess(true)
            // Store in sessionStorage to avoid re-asking
            sessionStorage.setItem('gameCodeVerified', Date.now().toString())
            setTimeout(() => {
                onSuccess()
            }, 800)
        } else {
            setError('Invalid code. Ask a teacher for the current code.')
            setCode(['', '', '', ''])
            inputRefs.current[0]?.focus()
        }

        setVerifying(false)
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-slate-900 border border-white/20 rounded-2xl p-8 w-full max-w-md text-center"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-xl font-bold text-white">Enter Game Code</h2>
                                    <p className="text-sm text-white/50">Ask your teacher for the code</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>
                        </div>

                        {/* Code Input */}
                        <div className="flex justify-center gap-3 mb-6">
                            {code.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => { inputRefs.current[index] = el }}
                                    type="tel"
                                    pattern="[0-9]*"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleDigitChange(index, e.target.value)}
                                    onKeyDown={e => handleKeyDown(index, e)}
                                    onPaste={handlePaste}
                                    disabled={verifying || success}
                                    className={`
                                        w-16 h-20 text-4xl font-bold text-center rounded-xl
                                        border-2 outline-none transition-all
                                        ${error ? 'border-red-500 bg-red-500/10' :
                                            success ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' :
                                                digit ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' :
                                                    'border-white/20 bg-white/5 text-white'}
                                        focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20
                                        disabled:opacity-50
                                    `}
                                />
                            ))}
                        </div>

                        {/* Status */}
                        {verifying && (
                            <div className="flex items-center justify-center gap-2 text-cyan-400 mb-4">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Verifying...</span>
                            </div>
                        )}

                        {success && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center justify-center gap-2 text-emerald-400 mb-4"
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">Code verified! Starting game...</span>
                            </motion.div>
                        )}

                        {error && (
                            <motion.div
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="flex items-center justify-center gap-2 text-red-400 mb-4"
                            >
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-sm">{error}</span>
                            </motion.div>
                        )}

                        {/* Timer hint */}
                        <div className="text-white/40 text-sm">
                            Code refreshes in <span className="text-cyan-400 font-mono">{expiresIn}s</span>
                        </div>

                        {/* Info */}
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <p className="text-white/50 text-sm">
                                Teachers can find the code in the{' '}
                                <span className="text-emerald-400 font-medium">Teacher App → Game Code</span> tab
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
