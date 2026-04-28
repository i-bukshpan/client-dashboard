'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { FinanceRecordActions } from './FinanceRecordActions'
import { Search, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  type: 'income' | 'expenses'
  data: any[]
}

export function FinanceTables({ type, data }: Props) {
  const isIncome = type === 'income'
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      row.category?.toLowerCase().includes(q) ||
      row.notes?.toLowerCase().includes(q) ||
      row.clients?.name?.toLowerCase().includes(q) ||
      String(row.amount).includes(q)
    )
  }, [data, search])

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden bg-white">
      {/* Search bar */}
      <div className="p-4 border-b border-border/40 bg-slate-50/30">
        <div className="relative max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`חפש ${isIncome ? 'הכנסה' : 'הוצאה'}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9 h-8 text-sm bg-white border-border/50 focus:border-primary/50"
          />
        </div>
      </div>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            {isIncome
              ? <TrendingUp className="w-12 h-12 opacity-15" />
              : <TrendingDown className="w-12 h-12 opacity-15" />
            }
            <p className="text-sm font-medium">
              {search ? 'לא נמצאו תוצאות לחיפוש' : `אין ${isIncome ? 'הכנסות' : 'הוצאות'} רשומות בתקופה זו`}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-primary hover:underline"
              >
                נקה חיפוש
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[100px] text-right font-bold">תאריך</TableHead>
                  {isIncome && <TableHead className="text-right font-bold">לקוח</TableHead>}
                  <TableHead className="text-right font-bold">קטגוריה</TableHead>
                  <TableHead className="text-right font-bold hidden md:table-cell">הערות</TableHead>
                  <TableHead className="text-left font-bold">סכום</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`group transition-colors ${
                      isIncome
                        ? 'hover:bg-emerald-50/40'
                        : 'hover:bg-red-50/40'
                    }`}
                  >
                    <TableCell className="text-[11px] text-slate-500 font-medium">
                      {format(new Date(row.date), 'dd/MM/yyyy')}
                    </TableCell>
                    {isIncome && (
                      <TableCell className="font-bold text-slate-900 text-sm">
                        {row.clients?.name ?? '—'}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          isIncome
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}
                      >
                        {row.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[150px] hidden md:table-cell">
                      {row.notes}
                    </TableCell>
                    <TableCell className={`text-left font-black ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}₪{Number(row.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-left">
                      <FinanceRecordActions id={row.id} type={isIncome ? 'income' : 'expenses'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-3 bg-slate-50/30 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} רשומות{search && ` (מתוך ${data.length})`}
              </span>
              <span className={`text-sm font-black ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                סה"כ: {isIncome ? '+' : '-'}₪{filtered.reduce((s, r) => s + Number(r.amount), 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
