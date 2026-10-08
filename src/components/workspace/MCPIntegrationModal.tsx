'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  FolderSearch,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Building2,
  RefreshCw,
  ExternalLink,
  Code,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getMcpConnectionInfoAction,
  testMcpConnectionAction,
  generateNewMcpTokenAction,
  revokeMcpTokenAction,
} from '@/app/workspace/actions/mcp-actions'

interface ToolItem {
  name: string
  titleHebrew: string
  category: string
  description: string
}

interface TokenItem {
  id: string
  name: string
  token_preview: string
  token?: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export function MCPIntegrationModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'quick' | 'tools' | 'guide' | 'tokens'>('quick')

  // Connection data
  const [endpointUrl, setEndpointUrl] = useState('')
  const [fullConnectUrl, setFullConnectUrl] = useState('')
  const [token, setToken] = useState('')
  const [tokenPreview, setTokenPreview] = useState('')
  const [mcpConfigJson, setMcpConfigJson] = useState('')
  const [tools, setTools] = useState<ToolItem[]>([])
  const [tokensList, setTokensList] = useState<TokenItem[]>([])

  // Live test state
  const [testStatus, setTestStatus] = useState<{
    tested: boolean
    success?: boolean
    latencyMs?: number
    toolCount?: number
    error?: string
  }>({ tested: false })
  const [isTesting, startTestTransition] = useTransition()

  // New token input
  const [newTokenName, setNewTokenName] = useState('')
  const [isCreatingToken, setIsCreatingToken] = useState(false)

  // Fetch info when modal opens
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getMcpConnectionInfoAction()
      if (res.success) {
        setEndpointUrl(res.endpointUrl)
        setFullConnectUrl(res.fullConnectUrl)
        setToken(res.token)
        setTokenPreview(res.tokenPreview)
        setMcpConfigJson(res.mcpConfigJson)
        setTools(res.toolsCatalog)
        setTokensList(res.allTokens)
      }
    } catch (err: any) {
      toast.error('שגיאה בטעינת נתוני חיבור MCP: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const copyToClipboard = (text: string, label: string, keyId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyId)
    toast.success(`${label} הועתק ללוח!`)
    setTimeout(() => {
      setCopiedKey(null)
    }, 2500)
  }

  const handleTestConnection = () => {
    startTestTransition(async () => {
      const res = await testMcpConnectionAction(token)
      if (res.success) {
        setTestStatus({
          tested: true,
          success: true,
          latencyMs: res.latencyMs,
          toolCount: res.toolCount,
        })
        toast.success(`חיבור MCP נבדק בהצלחה! (${res.toolCount} כלים זמינים, ${res.latencyMs}ms)`)
      } else {
        setTestStatus({
          tested: true,
          success: false,
          latencyMs: res.latencyMs,
          error: res.error,
        })
        toast.error(`בדיקת החיבור נכשלה: ${res.error}`)
      }
    })
  }

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      toast.error('נא להזין שם עבור המפתח')
      return
    }
    setIsCreatingToken(true)
    try {
      const res = await generateNewMcpTokenAction(newTokenName.trim())
      if (res.success && res.token) {
        toast.success(`מפתח חדש נוצר בהצלחה: "${newTokenName}"`)
        setNewTokenName('')
        await loadData()
      } else {
        toast.error('שגיאה ביצירת מפתח: ' + res.error)
      }
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message)
    } finally {
      setIsCreatingToken(false)
    }
  }

  const handleRevokeToken = async (id: string) => {
    try {
      const res = await revokeMcpTokenAction(id)
      if (res.success) {
        toast.success('המפתח בוטל בהצלחה')
        await loadData()
      } else {
        toast.error('שגיאה בביטול מפתח: ' + res.error)
      }
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message)
    }
  }

  const categoryIcons: Record<string, React.ReactNode> = {
    drive: <FolderSearch className="w-4 h-4 text-emerald-400" />,
    dashboard: <LayoutDashboard className="w-4 h-4 text-indigo-400" />,
    clients: <Users className="w-4 h-4 text-blue-400" />,
    operations: <CalendarCheck className="w-4 h-4 text-amber-400" />,
    moshe: <Building2 className="w-4 h-4 text-rose-400" />,
  }

  const categoryLabels: Record<string, string> = {
    drive: 'Drive וקבצים',
    dashboard: 'דשבורד וגיליונות',
    clients: 'לקוחות CRM',
    operations: 'משימות ויומן',
    moshe: 'נדל״ן משה',
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-emerald-500/10 hover:from-emerald-500/20 hover:to-indigo-500/20 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span>חיבור בוט וואטסאפ (MCP)</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-slate-950 text-slate-100 border-slate-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  חיבור MCP לבוט וואטסאפ
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px] font-normal">
                    שרת פעיל 2026
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  פרוטוקול MCP מאפשר לבוט הוואטסאפ באתר השני לתשאל ישירות קבצי גוגל, דשבורד לקוחות, משימות ונתונים.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-5 border-b border-slate-800/80 -mb-4 pb-2">
            <button
              onClick={() => setActiveTab('quick')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'quick'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              חיבור מהיר והעתקה
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'tools'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FolderSearch className="w-3.5 h-3.5" />
              כלים זמינים לבוט ({tools.length || 14})
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'guide'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              מדריך לוואטסאפ
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'tokens'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              מפתחות גישה
            </button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-sm">טוען הגדרות שרת MCP ומפתחות גישה...</p>
            </div>
          ) : activeTab === 'quick' ? (
            /* TAB 1: Quick Connect */
            <div className="space-y-5">
              {/* Main Primary Link Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-emerald-950/30 border border-indigo-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      קישור MCP מלא (כולל מפתח אימות)
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    מוכן להדבקה
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mt-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <code className="text-xs text-indigo-300 font-mono truncate flex-1 select-all" dir="ltr">
                    {fullConnectUrl || 'טוען קישור...'}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(fullConnectUrl, 'קישור ה-MCP המלא', 'full-url')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 font-semibold shrink-0 gap-1.5"
                  >
                    {copiedKey === 'full-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'full-url' ? 'הועתק!' : 'העתק קישור לבוט'}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  ✨ הדבק קישור זה בהגדרת ה-MCP בבוט הוואטסאפ באתר השני. הקישור מכיל מפתח אימות מאובטח ומתחבר ישירות לנתונים.
                </p>
              </div>

              {/* Extra Copy Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Clean URL */}
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">כתובת Endpoint נקייה:</span>
                    <p className="text-xs font-mono text-slate-200 mt-1 truncate" dir="ltr">
                      {endpointUrl}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(endpointUrl, 'כתובת ה-Endpoint', 'clean-url')}
                    className="mt-3 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5 w-full"
                  >
                    {copiedKey === 'clean-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    העתק כתובת בלבד
                  </Button>
                </div>

                {/* Token Only */}
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">מפתח גישה (Bearer Token):</span>
                    <p className="text-xs font-mono text-amber-300 mt-1 truncate" dir="ltr">
                      {tokenPreview || 'mcp_live_...'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(token, 'מפתח הגישה (Token)', 'token-only')}
                    className="mt-3 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5 w-full"
                  >
                    {copiedKey === 'token-only' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <KeyRound className="w-3.5 h-3.5" />}
                    העתק מפתח בלבד
                  </Button>
                </div>
              </div>

              {/* Test Live Connection Bar */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    בדיקת תקינות חיבור חיה (Live Ping)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    בודק שהשרת מקבל שאילתות JSON-RPC ומגיב כהלכה.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {testStatus.tested && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {testStatus.success ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          תקין! ({testStatus.toolCount} כלים, {testStatus.latencyMs}ms)
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          נכשל
                        </span>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    בדוק חיבור עכשיו
                  </Button>
                </div>
              </div>

              {/* JSON Config Snippet */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    קונפיגורציית JSON (ל-n8n / Claude Desktop / Cursor)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(mcpConfigJson, 'קונפיגורציית ה-JSON', 'json-cfg')}
                    className="text-[11px] text-slate-400 hover:text-white h-7 gap-1"
                  >
                    {copiedKey === 'json-cfg' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    העתק JSON
                  </Button>
                </div>
                <pre className="text-[11px] font-mono text-slate-400 bg-slate-950 p-3 rounded-lg overflow-x-auto border border-slate-850" dir="ltr">
                  {mcpConfigJson}
                </pre>
              </div>
            </div>
          ) : activeTab === 'tools' ? (
            /* TAB 2: Available Tools */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  הבוט בוואטסאפ יכול לקרוא לכל אחד מ-<strong>{tools.length}</strong> הכלים הבאים:
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                  כל הכלים במצב קריאה מאובטח
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {categoryIcons[tool.category] || <FolderSearch className="w-4 h-4 text-slate-400" />}
                        <span className="text-xs font-bold text-white">{tool.titleHebrew}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {categoryLabels[tool.category] || tool.category}
                      </span>
                    </div>
                    <code className="text-[11px] text-indigo-400 font-mono block mb-1.5" dir="ltr">
                      {tool.name}
                    </code>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'guide' ? (
            /* TAB 3: WhatsApp Bot Guide */
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  איך מחברים את בוט הוואטסאפ באתר השני?
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed pr-1">
                  <li>
                    <strong>העתק את הקישור:</strong> עבור ללשונית "חיבור מהיר" ולחץ על <strong>העתק קישור לבוט</strong>.
                  </li>
                  <li>
                    <strong>הגדרת הבוט (ב-n8n / בפלטפורמת הבוט):</strong>
                    <ul className="list-disc list-inside pr-4 mt-1 space-y-1 text-slate-400">
                      <li>אם הבוט ב-n8n: הוסף נוד מסוג <strong>MCP Tool</strong> או <strong>AI Agent</strong> וחבר את ה-Endpoint URL.</li>
                      <li>הגדר את סוג החיבור ל-<strong>HTTP Streamable / Server-Sent Events (SSE)</strong>.</li>
                      <li>הדבק את ה-URL המלא (כולל ה-Token) או הגדר Header: <code className="text-amber-300 font-mono">Authorization: Bearer &lt;Token&gt;</code>.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>הפעלת שאילתות בוואטסאפ:</strong> כעת הבוט יוכל להבין שאלות של משתמשים בוואטסאפ ולהפעיל את הכלים אוטומטית!
                  </li>
                </ol>
              </div>

              {/* Sample User Questions */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h5 className="font-bold text-white text-xs">דוגמאות לשאלות שמשתמשים יכולים לשאול את הבוט בוואטסאפ:</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <p className="text-emerald-300 font-medium">💬 "מה מופיע בדשבורד של לקוח ניסוי?"</p>
                    <p className="text-[11px] text-slate-400 mt-1">הבוט מפעיל את <code className="text-indigo-400">get_client_dashboard_overview</code> ומחזיר הכנסות, הוצאות ורווח.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <p className="text-emerald-300 font-medium">💬 "חפש לי חוזה שכירות בכונן"</p>
                    <p className="text-[11px] text-slate-400 mt-1">הבוט מפעיל את <code className="text-indigo-400">search_google_drive_files</code> ומציג את הקבצים שנמצאו וקישוריהם.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <p className="text-emerald-300 font-medium">💬 "איזה משימות פתוחות יש לי להיום?"</p>
                    <p className="text-[11px] text-slate-400 mt-1">הבוט מפעיל את <code className="text-indigo-400">get_daily_operational_agenda</code> ומסכם את סדר היום.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <p className="text-emerald-300 font-medium">💬 "מה המצב בפרויקטים של משה?"</p>
                    <p className="text-[11px] text-slate-400 mt-1">הבוט מפעיל את <code className="text-indigo-400">get_moshe_portal_summary</code> ומדווח על תשלומים באיחור ותזרים.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 4: Token Management */
            <div className="space-y-4">
              {/* Create new token */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white block">יצירת מפתח גישה חדש (Token):</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="למשל: בוט וואטסאפ ראשי n8n..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateToken}
                    disabled={isCreatingToken}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4"
                  >
                    {isCreatingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    צור מפתח
                  </Button>
                </div>
              </div>

              {/* Tokens list */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400">מפתחות רשומים במערכת:</span>
                {tokensList.map((tok) => (
                  <div
                    key={tok.id}
                    className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{tok.name}</span>
                        {tok.is_active ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                            פעיל
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30 bg-rose-500/10">
                            מבוטל
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                        <span className="font-mono text-slate-300" dir="ltr">{tok.token_preview}</span>
                        {tok.last_used_at ? (
                          <span>שימוש אחרון: {new Date(tok.last_used_at).toLocaleDateString('he-IL')}</span>
                        ) : (
                          <span>טרם נעשה שימוש</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tok.token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(`${endpointUrl}?token=${tok.token}`, 'קישור מלא', tok.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          העתק קישור
                        </Button>
                      )}
                      {tok.id !== 'default-primary-token' && tok.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeToken(tok.id)}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          בטל
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
