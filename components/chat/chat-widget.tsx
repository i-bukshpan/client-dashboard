'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Paperclip, ExternalLink, Minimize2, Maximize2, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
// import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase, type Message } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ChatWidgetProps {
    clientId: string
    clientName?: string
    senderRole?: 'client' | 'admin'
    forceOpen?: boolean
}

export function ChatWidget({ clientId, clientName, senderRole = 'client', forceOpen = false }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(forceOpen)
    const [isMinimized, setIsMinimized] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [activeContext, setActiveContext] = useState<any>(null)
    const [selectedContext, setSelectedContext] = useState<any>(null)

    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleContextEvent = (e: CustomEvent) => {
            if (e.detail) {
                setActiveContext(e.detail)
                setIsOpen(true)
                setIsMinimized(false)
            }
        }
        // @ts-ignore
        window.addEventListener('chat-context', handleContextEvent)
        // @ts-ignore
        return () => window.removeEventListener('chat-context', handleContextEvent)
    }, [])

    useEffect(() => {
        if (isOpen && clientId) {
            handleMarkAsRead()
        }
    }, [isOpen, clientId])

    const handleMarkAsRead = async () => {
        try {
            setUnreadCount(0)
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('client_id', clientId)
                .eq('sender_role', senderRole === 'admin' ? 'client' : 'admin')
                .eq('is_read', false)
        } catch (error) {
            console.error('Error marking messages as read:', error)
        }
    }

    useEffect(() => {
        if (!clientId) return

        loadMessages()

        console.log('ChatWidget: Subscribing to messages for client:', clientId)
        const channel = supabase
            .channel(`chat:${clientId}`) // Use a unique channel name per client
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `client_id=eq.${clientId}`
            }, (payload) => {
                console.log('ChatWidget: Realtime event received:', payload.eventType, payload)
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as Message
                    setMessages(prev => [...prev, newMsg])

                    // Update unread count if message is from other party
                    if (newMsg.sender_role !== senderRole) {
                        if (isOpen) {
                            handleMarkAsRead()
                        } else {
                            setUnreadCount(prev => prev + 1)
                        }
                    }
                } else if (payload.eventType === 'DELETE') {
                    const deletedId = payload.old.id
                    console.log('ChatWidget: Deleting message with ID:', deletedId)
                    setMessages(prev => prev.filter(m => m.id !== deletedId))
                    // Could also decrement unreadCount if we knew if the deleted message was unread
                }
            })
            .subscribe((status) => {
                console.log('ChatWidget: Subscription status:', status)
            })

        return () => {
            console.log('ChatWidget: Unsubscribing from messages')
            supabase.removeChannel(channel)
        }
    }, [clientId])

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages, isOpen])

    const loadMessages = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: true })

            if (error) throw error
            const msgs = data || []
            setMessages(msgs)

            // Calculate unread count (messages NOT sent by current role)
            const unread = msgs.filter(m => m.sender_role !== senderRole && !m.is_read).length
            setUnreadCount(unread)
        } catch (error) {
            console.error('Error loading messages:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return

        try {
            const { error } = await supabase
                .from('messages')
                .insert([{
                    client_id: clientId,
                    sender_role: senderRole,
                    content: newMessage,
                    context_type: activeContext?.type || 'general',
                    context_id: activeContext?.id || null,
                    context_name: activeContext?.name || null,
                    context_data: {
                        ...(activeContext?.data || {}),
                        navData: activeContext?.navData
                    },
                }])

            if (error) throw error

            setNewMessage('')
            setActiveContext(null)
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    const handleClearChat = async () => {
        if (!window.confirm("האם אתה בטוח שברצונך למחוק את כל היסטוריית הצ'אט? פעולה זו אינה ניתנת לביטול.")) return

        try {
            setLoading(true)
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('client_id', clientId)

            if (error) {
                console.error('ChatWidget: Supabase delete error:', error)
                alert("שגיאה במחיקת הצ'אט: " + error.message)
                return
            }

            setMessages([])
        } catch (error) {
            console.error('ChatWidget: Error in handleClearChat:', error)
            alert("שגיאה בלתי צפויה במחיקת הצ'אט")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <div className="fixed bottom-6 left-6 z-50">
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-lg bg-navy hover:bg-navy/90 p-0 flex items-center justify-center"
                >
                    <MessageCircle className="h-6 w-6 text-white" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </div>
        )
    }

    return (
        <>
            <Card
                className={cn(
                    "fixed bottom-6 left-6 flex flex-col shadow-2xl z-50 transition-all duration-300 bg-white overflow-hidden",
                    isMinimized ? "w-72 h-14" : "w-80 sm:w-96 h-[500px] max-h-[80vh]"
                )}
                dir="rtl"
            >
                <div
                    className="p-3 bg-navy text-white flex items-center justify-between cursor-pointer shrink-0"
                    onClick={() => !isMinimized && setIsMinimized(true)}
                >
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        <span className="font-semibold">תמיכה ושירות</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!isMinimized && senderRole === 'admin' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-white hover:bg-red-500/20"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleClearChat()
                                }}
                                title="נקה צ'אט (מנהל בלבד)"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-white hover:bg-white/10"
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsMinimized(!isMinimized)
                            }}
                        >
                            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-white hover:bg-white/10"
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsOpen(false)
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        <div className="flex-1 bg-gray-50 overflow-y-auto" ref={scrollRef}>
                            <div className="p-4 space-y-4">
                                {messages.length === 0 && (
                                    <div className="text-center text-grey text-sm py-8">
                                        היי {clientName || 'לקוח יקר'}, איך אפשר לעזור היום?
                                    </div>
                                )}

                                {messages.map((msg) => {
                                    const isMe = msg.sender_role === senderRole
                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "flex flex-col max-w-[85%]",
                                                isMe ? "ml-0 mr-auto items-end" : "mr-0 ml-auto items-start"
                                            )}
                                        >
                                            <div className={cn(
                                                "rounded-lg p-3 text-sm shadow-sm",
                                                isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white border rounded-bl-none"
                                            )}>
                                                {msg.context_type && msg.context_type !== 'general' && (
                                                    <div className={cn(
                                                        "text-xs mb-1 pb-1 border-b flex items-center gap-1 opacity-90",
                                                        isMe ? "border-white/20" : "border-gray-100 text-gray-500"
                                                    )}>
                                                        <Paperclip className="h-3 w-3" />
                                                        הקשר: {msg.context_name || 'פריט'}
                                                        <button
                                                            onClick={() => setSelectedContext({
                                                                type: msg.context_type,
                                                                name: msg.context_name,
                                                                data: msg.context_data
                                                            })}
                                                            className="mr-2 hover:bg-white/20 p-0.5 rounded transition-colors"
                                                            title="הצג פרטים"
                                                        >
                                                            <Eye className="h-3 w-3" />
                                                        </button>
                                                        {msg.context_data?.navData && (
                                                            <button
                                                                onClick={() => {
                                                                    console.log('Dispatching navigation:', msg.context_data.navData)
                                                                    window.dispatchEvent(new CustomEvent('chat-navigation', {
                                                                        detail: msg.context_data.navData
                                                                    }))
                                                                    setIsOpen(false)
                                                                }}
                                                                className="mr-1 hover:bg-white/20 p-0.5 rounded transition-colors"
                                                                title="נווט לפריט"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {msg.content}
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-1 px-1">
                                                {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="p-3 border-t bg-white shrink-0">
                            {activeContext && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-2 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-blue-700">שואל על:</span>
                                        <span className="truncate max-w-[150px]">{activeContext.name || activeContext.type}</span>
                                    </div>
                                    <button onClick={() => setActiveContext(null)} className="text-blue-400 hover:text-blue-600">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    handleSendMessage()
                                }}
                                className="flex gap-2"
                            >
                                <Input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="כתוב הודעה..."
                                    className="flex-1"
                                />
                                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </>
                )}
            </Card>

            <Dialog open={!!selectedContext} onOpenChange={(open) => !open && setSelectedContext(null)}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-white" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-navy flex items-center gap-2">
                            <Eye className="h-5 w-5 text-blue-500" />
                            פרטי הקשר: {selectedContext?.name}
                        </DialogTitle>
                        <DialogDescription>
                            פרטים נוספים אודות הפריט המקושר
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                        {selectedContext?.data ? (
                            <div className="grid grid-cols-1 gap-3">
                                {Object.entries(selectedContext.data)
                                    .filter(([key]) => !['id', 'navData', 'checkSum', 'clientId', 'branch_name', 'created_at', 'updated_at', 'client_id', 'module_name'].includes(key)) // Filter out internal/technical keys
                                    .map(([key, value]) => {
                                        // Hebrew translation map for common fields
                                        const translations: Record<string, string> = {
                                            'amount': 'סכום',
                                            'payment_date': 'תאריך תשלום',
                                            'payment_status': 'סטטוס',
                                            'payment_method': 'אמצעי תשלום',
                                            'category': 'קטגוריה',
                                            'description': 'תיאור',
                                            'notes': 'הערות',
                                            'next_payment_date': 'תאריך תשלום הבא',
                                            'is_recurring': 'תשלום מחזורי',
                                            'full_name': 'שם מלא',
                                            'email': 'אימייל',
                                            'phone': 'טלפון',
                                            'address': 'כתובת',
                                            'status': 'סטטוס',
                                            'type': 'סוג',
                                            'price': 'מחיר',
                                            'quantity': 'כמות',
                                            'total': 'סה"כ',
                                            'date': 'תאריך',
                                            'name': 'שם',
                                            'title': 'כותרת',
                                        };

                                        const label = translations[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                                        // Format value
                                        let displayValue = value as any;
                                        if (value === null || value === undefined || value === '') return null;
                                        if (typeof value === 'boolean') displayValue = value ? 'כן' : 'לא';
                                        if (typeof value === 'object') return null; // Skip complex objects

                                        // Check if value looks like a date
                                        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                                            try { displayValue = new Date(value).toLocaleDateString('he-IL'); } catch (e) { }
                                        }

                                        // Format currency if it's amount or price
                                        if (['amount', 'price', 'total'].includes(key) && typeof value === 'number') {
                                            displayValue = `₪${value.toLocaleString('he-IL')}`;
                                        }

                                        return (
                                            <div key={key} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
                                                <span className="text-xs text-gray-500 font-medium mb-1">{label}</span>
                                                <span className="text-sm font-semibold text-gray-800 break-words">{String(displayValue)}</span>
                                            </div>
                                        )
                                    })}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-8">
                                אין מידע נוסף זמין
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog >
        </>
    )
}
