'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { GameCodeModal } from '@/components/game/GameCodeModal'

interface CodeProtectionContextType {
    isVerified: boolean
    showModal: boolean
    verify: () => void
}

const CodeProtectionContext = createContext<CodeProtectionContextType | null>(null)

export function useCodeProtection() {
    const context = useContext(CodeProtectionContext)
    if (!context) throw new Error('useCodeProtection must be used within CodeProtectedLayout')
    return context
}

interface CodeProtectedLayoutProps {
    children: ReactNode
}

/**
 * Wraps protected pages and requires game code verification before showing content.
 * Once verified in a tab, it stays verified for the whole session (until tab closes).
 */
export function CodeProtectedLayout({ children }: CodeProtectedLayoutProps) {
    const [isVerified, setIsVerified] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [isChecking, setIsChecking] = useState(true)

    // Check verification status on mount
    useEffect(() => {
        const verified = sessionStorage.getItem('gameCodeVerified')
        if (verified === 'true') {
            setIsVerified(true)
        } else {
            setShowModal(true)
        }
        setIsChecking(false)
    }, [])

    const handleSuccess = () => {
        sessionStorage.setItem('gameCodeVerified', 'true')
        setIsVerified(true)
        setShowModal(false)
    }

    const handleClose = () => {
        // Redirect to landing page if they close without verifying
        window.location.href = '/'
    }

    // Show loading state while checking
    if (isChecking) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <CodeProtectionContext.Provider value={{ isVerified, showModal, verify: handleSuccess }}>
            {/* Always show the modal if not verified */}
            <GameCodeModal
                isOpen={showModal && !isVerified}
                onSuccess={handleSuccess}
                onClose={handleClose}
            />

            {/* Only render children if verified */}
            {isVerified ? children : (
                <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-white/60">Please enter the game code to continue...</p>
                    </div>
                </div>
            )}
        </CodeProtectionContext.Provider>
    )
}
