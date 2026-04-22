'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { Income, Expense } from '@/types/database'
import { format } from 'date-fns'

interface Props {
  income: (Income & { clients?: { name: string } | null })[]
  expenses: Expense[]
}

export function FinanceTables({ income, expenses }: Props) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-0">
        <Tabs defaultValue="income">
          <div className="flex items-center justify-between px-4 border-b border-border/50">
            <TabsList className="bg-transparent h-12 gap-6">
              <TabsTrigger
                value="income"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                פירוט הכנסות
              </TabsTrigger>
              <TabsTrigger
                value="expenses"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                פירוט הוצאות
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="income" className="m-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>הערות</TableHead>
                  <TableHead className="text-left">סכום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {income.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{format(new Date(row.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{row.clients?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{row.notes}</TableCell>
                    <TableCell className="text-left font-bold text-emerald-600">₪{Number(row.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="expenses" className="m-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>הערות</TableHead>
                  <TableHead className="text-left">סכום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{format(new Date(row.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{row.notes}</TableCell>
                    <TableCell className="text-left font-bold text-red-600">₪{Number(row.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}


