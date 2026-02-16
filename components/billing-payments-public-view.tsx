'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Clock, Repeat } from 'lucide-react'
import { supabase, type Payment } from '@/lib/supabase'
import { ChatContextTrigger } from '@/components/chat/chat-context-trigger'

interface BillingPaymentsPublicViewProps {
  clientId: string
  readOnly?: boolean
}

export function BillingPaymentsPublicView({ clientId, readOnly = true, highlightId }: BillingPaymentsPublicViewProps & { highlightId?: string }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('client_id', clientId)
          .order('payment_date', { ascending: false })

        if (error) throw error
        setPayments(data || [])
      } catch (error) {
        console.error('Error loading payments:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPayments()
  }, [clientId])

  useEffect(() => {
    if (highlightId && !loading && payments.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`payment-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50')
          }, 3000)
        }
      }, 500)
    }
  }, [highlightId, loading, payments])

  const totalPaid = payments
    .filter(p => p.payment_status === 'שולם')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalPending = payments
    .filter(p => p.payment_status === 'ממתין')
    .reduce((sum, p) => sum + p.amount, 0)

  if (loading) {
    return <div className="text-center py-8 text-grey">טוען תשלומים...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="text-sm text-green-700 mb-1">שולם</div>
          <div className="text-3xl font-bold text-green-900">
            ₪{totalPaid.toLocaleString('he-IL')}
          </div>
        </Card>
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <div className="text-sm text-yellow-700 mb-1">ממתין</div>
          <div className="text-3xl font-bold text-yellow-900">
            ₪{totalPending.toLocaleString('he-IL')}
          </div>
        </Card>
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-grey">
            אין תשלומים רשומים
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <Card
              key={payment.id}
              id={`payment-${payment.id}`}
              className="p-4 bg-white hover:shadow-md transition-shadow transition-colors duration-500"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {payment.payment_status === 'שולם' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    )}
                    {payment.is_recurring && <Repeat className="h-4 w-4 text-blue-600" />}
                    <span className="text-xl font-bold">
                      ₪{payment.amount.toLocaleString('he-IL')}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${payment.payment_status === 'שולם'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                      }`}>
                      {payment.payment_status}
                    </span>
                    {payment.payment_type && (
                      <span className="px-2 py-1 rounded text-xs bg-grey/20">
                        {payment.payment_type === 'income' ? 'הכנסה' :
                          payment.payment_type === 'expense' ? 'הוצאה' :
                            payment.payment_type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-grey space-y-1">
                    <div>תאריך: {new Date(payment.payment_date).toLocaleDateString('he-IL')}</div>
                    {payment.next_payment_date && (
                      <div className="text-blue-600">תשלום הבא: {new Date(payment.next_payment_date).toLocaleDateString('he-IL')}</div>
                    )}
                    {payment.category && <div>קטגוריה: {payment.category}</div>}
                    {payment.payment_method && <div>אמצעי תשלום: {payment.payment_method}</div>}
                    {payment.description && <div>תיאור: {payment.description}</div>}
                    {payment.notes && <div>הערות: {payment.notes}</div>}
                  </div>
                </div>
                <div>
                  <ChatContextTrigger
                    type="payment"
                    id={payment.id}
                    name={`תשלום בסך ₪${payment.amount} מ-${new Date(payment.payment_date).toLocaleDateString('he-IL')}`}
                    data={payment}
                    className="text-grey hover:text-blue-600"
                    navData={{ tab: 'billing', id: payment.id }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

