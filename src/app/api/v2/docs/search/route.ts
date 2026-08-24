import { NextRequest, NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { embed, generateText } from 'ai'
import { z } from 'zod'
import {
  getWorkspaceAdminDb,
  getWorkspaceClient,
  getWorkspaceErrorStatus,
  requireWorkspaceAdmin,
} from '@/lib/v2/workspace-dal'

export const dynamic = 'force-dynamic'

const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  client_id: z.string().uuid().optional(),
  file_type: z.enum(['receipt', 'invoice', 'contract', 'report', 'other']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    await requireWorkspaceAdmin()
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: getWorkspaceErrorStatus(error) }
    )
  }

  // 2. Parse body
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = SearchRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid search request' }, { status: 400 })
  const { query, client_id, file_type } = parsed.data
  if (client_id) {
    try {
      await getWorkspaceClient(client_id)
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Request failed' },
        { status: getWorkspaceErrorStatus(error) }
      )
    }
  }
  const db = getWorkspaceAdminDb()

  // 3. Embed the query — Gemini text-embedding-004 → 768 dims
  let queryEmbedding: number[]
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: query.trim(),
    })
    queryEmbedding = embedding as number[]
  } catch (err) {
    console.error('[v2/docs/search] Embedding error:', err)
    return NextResponse.json({ error: 'שגיאה ביצירת embedding לשאילתה' }, { status: 500 })
  }

  // 4. Semantic search via RPC
  const { data: chunks, error: searchError } = await db.rpc('search_v2_documents', {
    query_embedding: queryEmbedding,
    p_client_id: client_id ?? null,
    p_file_type: file_type ?? null,
    match_threshold: 0.60,
    match_count: 8,
  })

  if (searchError) {
    console.error('[v2/docs/search] RPC error:', searchError)
    return NextResponse.json({ error: `שגיאת חיפוש: ${searchError.message}` }, { status: 500 })
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({
      answer: 'לא נמצאו מסמכים רלוונטיים לשאלה זו. ודא שהמסמכים הועלו ועברו עיבוד OCR.',
      sources: [],
      query,
      chunks_found: 0,
    })
  }

  // 5. Build context from top chunks
  type ChunkResult = {
    chunk_id: string
    document_id: string
    file_name: string
    content: string
    similarity: number
    client_id: string
    file_type: string
    file_date: string | null
    amount: number | null
    drive_url: string | null
  }

  const context = (chunks as ChunkResult[])
    .map((c, i) => `[מקור ${i + 1} — ${c.file_name} (${c.file_type}, דמיון: ${(c.similarity * 100).toFixed(0)}%)]:\n${c.content}`)
    .join('\n\n---\n\n')

  // 6. Generate answer with Gemini
  const systemPrompt = `אתה עוזר AI חכם למערכת ניהול מסמכים פיננסיים.
המשתמש הוא יועץ עסקי בשם נחמיה. ענה בעברית בצורה ממוקדת ומדויקת.
השתמש רק במידע מהמקורות שסופקו. אם אין מידע מספק, אמור זאת בבירור.
פרמט כספי: ₪ עם פסיקים (למשל ₪1,250).`

  const userPrompt = `שאלה: ${query}

מסמכים רלוונטיים:
${context}

ענה על השאלה בהתבסס על המסמכים לעיל. היה תמציתי (3-5 משפטים).`

  let answer: string
  try {
    const result = await generateText({
      model: google('gemini-2.0-flash-lite'),
      system: systemPrompt,
      prompt: userPrompt,
    })
    answer = result.text
  } catch (err) {
    console.error('[v2/docs/search] Gemini generation error:', err)
    answer = 'לא ניתן לייצר תשובה כרגע. הנה המקורות הרלוונטיים שנמצאו:'
  }

  // 7. Deduplicate sources by document_id
  const uniqueDocs = new Map<string, ChunkResult>()
  ;(chunks as ChunkResult[]).forEach(c => {
    if (!uniqueDocs.has(c.document_id) || c.similarity > uniqueDocs.get(c.document_id)!.similarity) {
      uniqueDocs.set(c.document_id, c)
    }
  })

  const sources = Array.from(uniqueDocs.values()).map(c => ({
    document_id: c.document_id,
    file_name: c.file_name,
    file_type: c.file_type,
    file_date: c.file_date,
    amount: c.amount,
    drive_url: c.drive_url,
    similarity: Math.round(c.similarity * 100),
  }))

  return NextResponse.json({
    answer,
    sources,
    query,
    chunks_found: chunks.length,
  })
}
