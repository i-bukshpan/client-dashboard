'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklineChartProps {
    data: Array<{ month: string; value: number }>
    color?: string
    className?: string
}

export function SparklineChart({ data, color = '#10b981', className = '' }: SparklineChartProps) {
    // Don't render if no data
    if (!data || data.length === 0) {
        return null
    }

    return (
        <div className={`w-full ${className}`} style={{ height: '40px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
