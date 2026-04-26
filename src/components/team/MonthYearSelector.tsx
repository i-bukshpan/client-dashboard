'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  currentMonth: number
  currentYear: number
}

export function MonthYearSelector({ currentMonth, currentYear }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParams(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(name, value)
    router.push(`?${params.toString()}`)
  }

  return (
    <form className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
      <select 
        name="month" 
        value={currentMonth}
        className="bg-transparent text-sm font-medium outline-none px-2 cursor-pointer"
        onChange={(e) => updateParams('month', e.target.value)}
      >
        {[...Array(12)].map((_, i) => (
          <option key={i + 1} value={i + 1}>
            {new Date(2000, i).toLocaleString('he-IL', { month: 'long' })}
          </option>
        ))}
      </select>
      <div className="w-px h-4 bg-slate-200" />
      <select 
        name="year" 
        value={currentYear}
        className="bg-transparent text-sm font-medium outline-none px-2 cursor-pointer"
        onChange={(e) => updateParams('year', e.target.value)}
      >
        {[2024, 2025, 2026, 2027].map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </form>
  )
}
