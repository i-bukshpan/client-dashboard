'use client'

import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
// import {
//     Tooltip,
//     TooltipContent,
//     TooltipProvider,
//     TooltipTrigger,
// } from '@/components/ui/tooltip'

interface ChatContextTriggerProps {
    type: 'general' | 'module' | 'payment' | 'credential' | 'note'
    id: string
    name: string // Human readable name (e.g., "Payment #123")
    data?: any
    icon?: React.ReactNode
    label?: string
    variant?: 'default' | 'outline' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    className?: string
    navData?: {
        tab: string
        id?: string
        subTab?: string
        innerTab?: string
    }
}

export function ChatContextTrigger({
    type,
    id,
    name,
    data,
    icon,
    label,
    variant = 'ghost',
    size = 'icon',
    className,
    navData
}: ChatContextTriggerProps) {

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        const event = new CustomEvent('chat-context', {
            detail: { type, id, name, data, navData }
        })
        window.dispatchEvent(event)
    }

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleClick}
            className={`text-blue-500 hover:text-blue-700 hover:bg-blue-50 ${className || ''}`}
            title={`שאל לגבי ${name}`}
        >
            {icon || <MessageSquarePlus className="h-4 w-4" />}
            {label && <span className="mr-2">{label}</span>}
        </Button>
    )
}
