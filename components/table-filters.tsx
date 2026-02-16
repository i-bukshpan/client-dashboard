'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, X } from 'lucide-react'
import type { ColumnDefinition } from '@/lib/supabase'
import type { ColumnFiltersState } from '@tanstack/react-table'

interface TableFiltersProps {
  columns: ColumnDefinition[]
  columnFilters: ColumnFiltersState
  globalFilter: string
  onColumnFiltersChange: (filters: ColumnFiltersState) => void
  onGlobalFilterChange: (filter: string) => void
  showFilters: boolean
  onToggleFilters: () => void
  columnValueOptions?: Record<string, string[]>
}

export function TableFilters({
  columns,
  columnFilters,
  globalFilter,
  onColumnFiltersChange,
  onGlobalFilterChange,
  showFilters,
  onToggleFilters,
  columnValueOptions = {},
}: TableFiltersProps) {
  const getColumnFilter = (columnId: string) => {
    return columnFilters.find(f => f.id === columnId)?.value as string | undefined
  }

  const setColumnFilter = (columnId: string, value: string) => {
    const newFilters = columnFilters.filter(f => f.id !== columnId)
    if (value && value !== '') {
      newFilters.push({ id: columnId, value })
    }
    onColumnFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    onColumnFiltersChange([])
    onGlobalFilterChange('')
  }

  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== ''

  return (
    <div className="space-y-4">
      {/* Global Search and Filter Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-grey" />
          <Input
            placeholder="חיפוש בכל העמודות..."
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={onToggleFilters}
          className={`gap-2 ${showFilters ? 'bg-emerald/10 border-emerald' : ''}`}
        >
          <Filter className="h-4 w-4" />
          סינון לפי עמודות
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearAllFilters} className="gap-2 text-sm">
            <X className="h-4 w-4" />
            נקה כל הסינונים
          </Button>
        )}
      </div>

      {/* Column Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {columns
              .filter(col => col.type !== 'formula' && col.type !== 'reference')
              .map((column) => {
                const filterValue = getColumnFilter(column.name)
                
                if (column.type === 'number') {
                  return (
                    <div key={column.name}>
                      <Label className="text-sm">{column.label}</Label>
                      <Input
                        type="number"
                        placeholder={`סינון ${column.label}...`}
                        value={filterValue || ''}
                        onChange={(e) => setColumnFilter(column.name, e.target.value)}
                      />
                    </div>
                  )
                } else if (column.type === 'date') {
                  return (
                    <div key={column.name}>
                      <Label className="text-sm">{column.label}</Label>
                      <Input
                        type="date"
                        value={filterValue || ''}
                        onChange={(e) => setColumnFilter(column.name, e.target.value)}
                      />
                    </div>
                  )
                } else {
                  const options = columnValueOptions[column.name] || []
                  if (options.length > 0) {
                    return (
                      <div key={column.name}>
                        <Label className="text-sm">{column.label}</Label>
                        <Select
                          value={filterValue ? String(filterValue) : '__all__'}
                          onValueChange={(value) =>
                            setColumnFilter(column.name, value === '__all__' ? '' : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`בחר ${column.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">הכל</SelectItem>
                            {options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }
                  return (
                    <div key={column.name}>
                      <Label className="text-sm">{column.label}</Label>
                      <Input
                        type="text"
                        placeholder={`סינון ${column.label}...`}
                        value={filterValue || ''}
                        onChange={(e) => setColumnFilter(column.name, e.target.value)}
                      />
                    </div>
                  )
                }
              })}
          </div>
        </Card>
      )}
    </div>
  )
}

