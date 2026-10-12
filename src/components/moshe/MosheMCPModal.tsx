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
  Building2,
  CalendarCheck,
  Users,
  CreditCard,
  HardHat,
  RefreshCw,
  ExternalLink,
  Code,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FolderKanban,
  MessageSquare,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getMosheMcpConnectionInfoAction,
  testMosheMcpConnectionAction,
  generateNewMosheMcpTokenAction,
  revokeMosheMcpTokenAction,
} from '@/app/moshe/actions/mcp-actions'

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

interface Props {
  trigger?: React.ReactNode
}

export function MosheMCPModal({ trigger }: Props) {
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
      const res = await getMosheMcpConnectionInfoAction()
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
      toast.error('שגיאה בטעינת נתוני חיבור MCP')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
      setTestStatus({ tested: false })
    }
  }, [open])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success('הועתק ללוח!')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleTestConnection = () => {
    startTestTransition(async () => {
      const res = await testMosheMcpConnectionAction(token)
      if (res.success) {
        setTestStatus({
          tested: true,
          success: true,
          latencyMs: res.latencyMs,
          toolCount: res.toolCount,
        })
        toast.success(`בדיקת שרת עברה בהצלחה! זמן תגובה: ${res.latencyMs}ms`)
      } else {
        setTestStatus({
          tested: true,
          success: false,
          error: res.error,
          latencyMs: res.latencyMs,
        })
        toast.error(`בדיקת חיבור נכשלה: ${res.error}`)
      }
    })
  }

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      toast.error('יש להזין שם עבור המפתח')
      return
    }
    setIsCreatingToken(true)
    try {
      const res = await generateNewMosheMcpTokenAction(newTokenName.trim())
      if (res.success) {
        toast.success('מפתח גישה חדש נוצר בהצלחה')
        setNewTokenName('')
        loadData()
      } else {
        toast.error(res.error || 'שגיאה ביצירת מפתח')
      }
    } catch {
      toast.error('שגיאה ביצירת מפתח')
    } finally {
      setIsCreatingToken(false)
    }
  }

  const handleRevokeToken = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך להשבית מפתח זה? כל בוט המשתמש בו יפסיק לפעול.')) return
    try {
      const res = await revokeMosheMcpTokenAction(id)
      if (res.success) {
        toast.success('המפתח הושבת בהצלחה')
        loadData()
      } else {
        toast.error(res.error || 'שגיאה בהשבתת מפתח')
      }
    } catch {
      toast.error('שגיאה בהשבתת מפתח')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-300 text-xs font-bold shadow-xs h-8"
          >
            <Bot className="w-4 h-4 text-amber-600" />
            <span>חיבור בוטים (MCP)</span>
            <Badge
              variant="secondary"
              className="bg-amber-500 text-white text-[9px] px-1.5 py-0 h-4 border-none"
            >
              LIVE
            </Badge>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className="!max-w-[min(96vw,1200px)] !w-[min(96vw,1200px)] sm:!max-w-[min(96vw,1200px)] sm:!w-[min(96vw,1200px)] max-h-[92vh] overflow-y-auto p-0 bg-white border border-slate-200 text-slate-800"
        style={{ width: 'min(96vw, 1200px)', maxWidth: 'min(96vw, 1200px)' }}
        dir="rtl"
      >
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                  חיבור בוטים חיצוניים ו-MCP — פורטל משה
                  <span className="text-xs bg-amber-500/30 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-mono">
                    v1.0 Streamable HTTP
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-300 mt-1">
                  חיבור בוטים (WhatsApp / n8n / Cursor / Claude) בלעדית למידע של פורטל משה פרוש
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>גישה מוגבלת לפורטל משה בלבד</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-6 border-b border-slate-700/60 pb-1">
            <button
              onClick={() => setActiveTab('quick')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'quick'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              חיבור מהיר
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'tools'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              כלים זמינים לבוט ({tools.length})
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'guide'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              מדריך שימוש
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'tokens'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              ניהול מפתחות
            </button>
          </div>
        </DialogHeader>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-sm">טוען נתוני חיבור לשרת MCP...</p>
            </div>
          ) : (
            <>
              {/* ── TAB 1: QUICK CONNECT ── */}
              {activeTab === 'quick' && (
                <div className="space-y-6">
                  {/* Security Notice */}
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        אבטחה והגבלת גישה מוחלטת למידע של משה
                      </p>
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        שרת זה מאפשר גישה <strong>אך ורק</strong> לפרויקטים, לקונים, להלוואות, לתשלומים, לשותפים ולעובדים של פורטל משה.
                        לבוטים חיצוניים אין גישה לקבצי ה-Drive, ללקוחות ה-CRM הכלליים או למיילים של נחמיה.
                      </p>
                    </div>
                  </div>

                  {/* Primary Connection String */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>כתובת שרת ה-MCP (Streamable HTTP / SSE Endpoint):</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        פרוטוקול MCP הרשמי של Anthropic / Google
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 text-amber-300 p-2.5 rounded-xl font-mono text-xs border border-slate-800 truncate text-left" dir="ltr">
                        {endpointUrl}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(endpointUrl, 'endpoint')}
                        className="h-9 px-3 gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                      >
                        {copiedKey === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        העתק
                      </Button>
                    </div>
                  </div>

                  {/* API Key / Bearer Token */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>מפתח אימות (Bearer Token):</span>
                      <span className="text-[10px] text-amber-600 font-bold">שמור בסוד — מיועד לבוטים מאושרים בלבד</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-xs border border-slate-800 truncate text-left" dir="ltr">
                        {token ? token : '••••••••••••••••••••••••••••••••'}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(token, 'token')}
                        className="h-9 px-3 gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                      >
                        {copiedKey === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        העתק מפתח
                      </Button>
                    </div>
                  </div>

                  {/* Live Connection Test Button */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        בדיקת שרת לייב (Live Health Ping)
                        {testStatus.tested && (
                          testStatus.success ? (
                            <span className="text-emerald-600 text-[10px] flex items-center gap-1 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> תקין ({testStatus.latencyMs}ms, {testStatus.toolCount} כלים)
                            </span>
                          ) : (
                            <span className="text-red-500 text-[10px] flex items-center gap-1 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" /> שגיאה ({testStatus.error})
                            </span>
                          )
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        מבצע פניית JSON-RPC 2.0 לבדיקת זמינות השרת ומספר הכלים הנטענים.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 h-8 shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      {isTesting ? 'בודק...' : 'בדוק חיבור כעת'}
                    </Button>
                  </div>

                  {/* JSON Config for Cursor / Claude Desktop */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        הגדרות מוכנות ל-Cursor ו-Claude Desktop (קובץ JSON):
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(mcpConfigJson, 'json')}
                        className="h-6 text-[11px] gap-1 text-amber-600 hover:text-amber-700"
                      >
                        {copiedKey === 'json' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        העתק בלוק JSON
                      </Button>
                    </div>
                    <pre className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed border border-slate-800 overflow-x-auto text-left dir-ltr max-h-48">
                      {mcpConfigJson}
                    </pre>
                  </div>
                </div>
              )}

              {/* ── TAB 2: TOOLS CATALOG ── */}
              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        כלים זמינים לבוט ({tools.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        כל הכלים מוגבלים אוטומטית לנתוני פורטל משה בלבד. הבוט יכול לתשאל, לחשב ולהוסיף תשלומים.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pe-1">
                    {tools.map((t) => (
                      <div
                        key={t.name}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-xs transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {t.category}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">{t.titleHebrew}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB 3: USER GUIDE ── */}
              {activeTab === 'guide' && (
                <div className="space-y-5 max-h-[520px] overflow-y-auto pe-1 text-slate-700">
                  {/* Guide 1: WhatsApp Bot via n8n */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <h4>1. חיבור לבוט וואטסאפ (n8n / WhatsApp Bot)</h4>
                    </div>
                    <ol className="list-decimal list-inside text-xs space-y-2 leading-relaxed text-slate-600">
                      <li>
                        ב-n8n או בפלטפורמת הבוט, הוסף צומת <strong>AI Agent</strong> ובחר באפשרות <strong>Tools ➔ MCP Tool</strong> (או HTTP Request JSON-RPC).
                      </li>
                      <li>
                        הזן את כתובת ה-Endpoint: <code className="bg-white px-1.5 py-0.5 rounded border text-slate-800">{endpointUrl}</code>.
                      </li>
                      <li>
                        הוסף כותרת אימות (Header): <code className="bg-white px-1.5 py-0.5 rounded border text-slate-800">Authorization: Bearer &lt;TOKEN&gt;</code>.
                      </li>
                      <li>
                        הבוט מוכן! כעת ניתן לשאול בוואטסאפ:
                        <ul className="list-disc list-inside ms-4 mt-1 text-[11px] text-slate-500 space-y-0.5">
                          <li>"משה, מה היתרה והכסף בקופה של פרויקט הרצל?"</li>
                          <li>"אילו תשלומים מתוכננים לשבוע הקרוב?"</li>
                          <li>"כמה שולם בפועל לקבלן השלד?"</li>
                          <li>"מה סטטוס הקונים והתשלומים שהתקבלו?"</li>
                        </ul>
                      </li>
                    </ol>
                  </div>

                  {/* Guide 2: Cursor */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                      <Code className="w-4 h-4 text-blue-600" />
                      <h4>2. חיבור ב-Cursor AI</h4>
                    </div>
                    <ol className="list-decimal list-inside text-xs space-y-1.5 leading-relaxed text-slate-600">
                      <li>פתח את Cursor והיכנס להגדרות: <strong>Settings ➔ Features ➔ MCP</strong>.</li>
                      <li>לחץ על <strong>+ Add New MCP Server</strong>.</li>
                      <li>בחר ב-Type: <code>command</code> או <code>sse / streamable-http</code> והדבק את בלוק ה-JSON מכרטיסיית "חיבור מהיר".</li>
                      <li>בצ'אט של Cursor תוכל לשאול ישירות על נתוני הפרויקטים והתשלומים של משה.</li>
                    </ol>
                  </div>

                  {/* Guide 3: Claude Desktop */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                      <Bot className="w-4 h-4 text-purple-600" />
                      <h4>3. חיבור ב-Claude Desktop</h4>
                    </div>
                    <ol className="list-decimal list-inside text-xs space-y-1.5 leading-relaxed text-slate-600">
                      <li>פתח את קובץ ההגדרות: <code>%APPDATA%\Claude\claude_desktop_config.json</code>.</li>
                      <li>הדבק את האובייקט <code>moshe_portal</code> תחת <code>mcpServers</code>.</li>
                      <li>הפעל מחדש את Claude Desktop — סמל הפטיש (Tools) יציג את כל כלי הנדל״ן של משה.</li>
                    </ol>
                  </div>

                  {/* Guide 4: Isolation Guarantee */}
                  <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <h4>הבטחת בידוד נתונים והרשאות</h4>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      השרת מוגדר באופן קשיח ברמת הקוד להפעיל רק את כלי פורטל משה. גם אם בוט חיצוני ינסה לבקש קבצי דרייב או נתוני לקוחות של נחמיה, השרת יסרב ויחזיר שגיאת הרשאה, מכיוון שכלים אלו אינם רשומים בשרת זה.
                    </p>
                  </div>
                </div>
              )}

              {/* ── TAB 4: TOKENS MANAGEMENT ── */}
              {activeTab === 'tokens' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">ניהול מפתחות גישה (Tokens)</h3>
                      <p className="text-xs text-slate-500">
                        יצירה והשבתה של מפתחות גישה נפרדים עבור בוטים ושירותים שונים
                      </p>
                    </div>
                  </div>

                  {/* Add New Token Box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="שם המפתח (לדוגמה: בוט שטח וואטסאפ)..."
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateToken}
                      disabled={isCreatingToken}
                      className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 shadow-xs"
                    >
                      {isCreatingToken ? 'יוצר...' : 'צור מפתח חדש'}
                    </Button>
                  </div>

                  {/* Tokens List */}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {tokensList.map((t) => (
                      <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">{t.name}</p>
                          <p className="text-[10px] font-mono text-slate-400" dir="ltr">
                            {t.token_preview}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            נוצר ב: {new Date(t.created_at).toLocaleDateString('he-IL')}
                            {t.last_used_at && ` · שימוש אחרון: ${new Date(t.last_used_at).toLocaleDateString('he-IL')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={t.is_active ? 'default' : 'secondary'}
                            className={t.is_active ? 'bg-emerald-500 text-white text-[10px]' : 'text-[10px]'}
                          >
                            {t.is_active ? 'פעיל' : 'מושבת'}
                          </Badge>
                          {t.is_active && t.id !== 'default-moshe-token' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevokeToken(t.id)}
                              className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                            >
                              השבת
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
