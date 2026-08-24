'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintDashboardButton() {
  return <Button onClick={() => window.print()} className="fixed bottom-5 left-5 print:hidden"><Printer className="size-4" />הדפסה / שמירה כ-PDF</Button>
}
