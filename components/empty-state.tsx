import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
    className?: string
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
            <div className="mb-4 p-4 rounded-full bg-grey/10">
                <Icon className="h-12 w-12 text-grey" />
            </div>
            <h3 className="text-lg font-semibold text-navy mb-2">{title}</h3>
            <p className="text-sm text-grey max-w-md mb-6">{description}</p>
            {actionLabel && onAction && (
                <Button onClick={onAction} size="lg">
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}
