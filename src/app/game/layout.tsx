'use client'

import { CodeProtectedLayout } from '@/components/game/CodeProtectedLayout'

export default function GameLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <CodeProtectedLayout>
            {children}
        </CodeProtectedLayout>
    )
}
