/**
 * /share/artifact/[token] — Public read-only view of a Studio Artifact.
 * Styled with luxury glassmorphism, RTL, secure read-only display.
 */

import { notFound } from 'next/navigation'
import { getSharedArtifact, type ArtifactType } from '@/lib/v2/notebook-artifacts'
import {
  FileText,
  BarChart3,
  ClipboardList,
  Table2,
  Briefcase,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, { label: string; icon: React.ElementType; color: string }> = {
  card:         { label: 'כרטיס KPI',       icon: BarChart3,     color: 'text-violet-500' },
  brief:        { label: 'בריף מנהלים',     icon: FileText,      color: 'text-indigo-500' },
  chart:        { label: 'תרשים נתונים',    icon: BarChart3,     color: 'text-emerald-500' },
  action_plan:  { label: 'תוכנית פעולה',    icon: ClipboardList, color: 'text-amber-500' },
  table:        { label: 'טבלת נתונים',     icon: Table2,        color: 'text-sky-500' },
  meeting_prep: { label: 'תקציר פגישה',     icon: Briefcase,     color: 'text-rose-500' },
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function SharedArtifactPage({ params }: PageProps) {
  const { token } = await params
  const artifact = await getSharedArtifact(token)

  if (!artifact) {
    notFound()
  }

  const typeConfig = ARTIFACT_TYPE_LABELS[artifact.artifact_type] || {
    label: 'ארטיפקט',
    icon: FileText,
    color: 'text-primary',
  }
  const Icon = typeConfig.icon

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-8" dir="rtl">
      {/* Container */}
      <div className="w-full max-w-3xl space-y-6">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${typeConfig.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">{artifact.title}</h1>
                <Badge variant="outline" className="text-xs bg-slate-900/60 border-slate-700 text-slate-300">
                  {typeConfig.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  נוצר: {new Date(artifact.created_at).toLocaleDateString('he-IL')}
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  מאומת מתוך Nehemiah OS v3
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Artifact Content */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-6">
          {artifact.content_md ? (
            <div className="prose prose-invert prose-sm sm:prose-base max-w-none whitespace-pre-wrap leading-relaxed">
              {artifact.content_md}
            </div>
          ) : null}

          {/* If there is structured JSON content */}
          {artifact.content_json && Object.keys(artifact.content_json).length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 font-mono text-xs overflow-x-auto text-slate-300">
              <pre>{JSON.stringify(artifact.content_json, null, 2)}</pre>
            </div>
          ) : null}
        </article>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 pt-4 border-t border-slate-900">
          מסמך זה הופק בצורה מאובטחת באמצעות מערכת Nehemiah OS v3 — Smart Notebook Edition
        </footer>
      </div>
    </main>
  )
}
