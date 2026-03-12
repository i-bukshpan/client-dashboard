'use client'

import { useState, useEffect } from 'react'
import { supabase, type Client } from '@/lib/supabase'
import Link from 'next/link'
import { Users, ChevronLeft, Clock } from 'lucide-react'

interface RecentlyViewedClient {
  id: string
  name: string
  lastViewed: number
}

export function RecentlyViewed() {
  const [clients, setClients] = useState<RecentlyViewedClient[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('recentlyViewedClients')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RecentlyViewedClient[]
        // Sort by lastViewed descending and take top 4
        setClients(parsed.sort((a, b) => b.lastViewed - a.lastViewed).slice(0, 4))
      } catch (e) {
        console.error('Failed to parse recently viewed clients', e)
      }
    }
  }, [])

  if (clients.length === 0) return null

  return (
    <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/40 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-5 w-5 text-indigo-500" />
        <h2 className="text-xl font-black text-navy">נצפו לאחרונה</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/clients/${client.id}`}
            className="group flex items-center justify-between p-4 bg-white/60 hover:bg-white border border-transparent hover:border-indigo-100 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <Users className="h-5 w-5" />
              </div>
              <span className="font-black text-navy truncate max-w-[100px]">{client.name}</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-grey group-hover:translate-x-[-4px] transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  )
}
