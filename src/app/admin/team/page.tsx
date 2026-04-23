import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, TrendingUp, DollarSign } from 'lucide-react'
import { AddEmployeeSheet } from '@/components/team/AddEmployeeSheet'
import { EmployeeActions } from '@/components/team/EmployeeActions'
import { EmployeeSalaryCard } from '@/components/team/EmployeeSalaryCard'

export const metadata = { title: 'ניהול צוות | Nehemiah OS' }

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()

  // Fetch employees and their bonuses for current month
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const [{ data: employees }, { data: bonuses }] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'employee'),
    supabase.from('employee_bonuses').select('*').gte('date', startOfMonth),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shadow-inner">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-xl">ניהול צוות</h2>
            <p className="text-muted-foreground text-sm">ניהול עובדים ומשכורות</p>
          </div>
        </div>
        <AddEmployeeSheet />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(employees as any[])?.map((emp: any) => {
          const empBonuses = (bonuses as any[])?.filter(b => b.employee_id === emp.id) ?? []
          const totalBonuses = empBonuses.reduce((s, b) => s + Number(b.amount), 0)
          const totalSalary = Number(emp.salary_base) + totalBonuses

          return (
            <Card key={emp.id} className="border-border/50 shadow-sm overflow-hidden group hover:border-blue-200 transition-all">
              <CardHeader className="flex flex-row items-center gap-4 border-b border-border/50 bg-muted/20 py-4">
                <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                  <AvatarImage src={emp.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-blue-600 text-white font-bold">
                    {emp.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">{emp.full_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">עובד</Badge>
                  <EmployeeActions employeeId={emp.id} email={emp.email} name={emp.full_name} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <EmployeeSalaryCard
                  employeeId={emp.id}
                  baseSalary={Number(emp.salary_base)}
                  bonuses={empBonuses}
                  totalSalary={totalSalary}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}


