// ── AI Agent Types ──────────────────────────────────────────────────────────

export interface AgentContext {
  clientId?: string
  clientName?: string
  pageUrl: string
  isPortalMode?: boolean  // Client portal - restricts AI to single client scope
}

export interface AttachedFile {
  name: string
  mimeType: string
  data: string // base64
  size: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallRecord[]
  attachedFile?: AttachedFile
  createdAt: Date
}

export interface ToolCallRecord {
  toolName: string
  args: Record<string, any>
  result: any
  success: boolean
}

export interface AgentRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string; file?: AttachedFile }>
  context: AgentContext
}

// Gemini API types
export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args: Record<string, any> }
  functionResponse?: { name: string; response: Record<string, any> }
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[]
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}
