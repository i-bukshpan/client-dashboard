import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `Role: You are an expert financial data extraction engine specialized in OCR and document understanding.

Task: Analyze the attached invoice (PDF or Image) and extract all relevant data points into a clean, structured JSON format.

Extraction Rules:

Supplier Info: Extract legal name, VAT ID (ח"פ), and full address.
Transaction Details: Extract invoice number, issue date, and currency.
Line Items: Create an array of objects containing description, quantity, price per unit, and total.
Financial Summary: Extract subtotal (before VAT), VAT amount (typically 17% in Israel), and Grand Total.

Language: If the invoice is in Hebrew, translate the keys to English but keep the values in their original language.

Output Constraints:
- Return ONLY a valid JSON object.
- No conversational text, no "Here is the data", and no markdown code blocks.
- If a field is missing, return null.

Also extract these additional fields for the system:
- "amount": the grand total as a number
- "payment_date": the invoice date in YYYY-MM-DD format
- "payment_method": payment method in Hebrew if mentioned (e.g. 'העברה בנקאית', 'מזומן', 'כרטיס אשראי', 'צ׳ק', 'ביט'), or null
- "description": a brief Hebrew description of what the invoice is for
- "payment_type": one of 'income', 'expense', 'other'
- "category": category in Hebrew (e.g. 'שכירות', 'חשמל', 'שירותים', 'ציוד')
- "vendor_name": the supplier/vendor name
- "invoice_number": the invoice number

JSON Schema:
{
  "supplier": { "name": string, "vat_id": string, "address": string },
  "invoice_meta": { "number": string, "date": string, "currency": string },
  "items": [ { "desc": string, "qty": number, "price": number, "total": number } ],
  "totals": { "subtotal": number, "vat_amount": number, "grand_total": number },
  "amount": number,
  "payment_date": string,
  "payment_method": string | null,
  "description": string,
  "payment_type": string,
  "category": string,
  "vendor_name": string,
  "invoice_number": string
}`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('invoice') as File

    if (!file) {
      return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך. נא להעלות תמונה (JPG, PNG, WebP) או PDF' }, { status: 400 })
    }

    // Convert to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'מפתח Gemini API לא מוגדר. יש להוסיף GEMINI_API_KEY לקובץ .env.local' },
        { status: 500 }
      )
    }

    // Try models in order - based on available models in the account
    const models = ['gemini-2.0-flash', 'gemini-2.5-flash']
    let lastError = ''

    for (const model of models) {
      console.log(`Trying model: ${model}`)

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64,
                    },
                  },
                  {
                    text: EXTRACTION_PROMPT,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 16384,
            },
          }),
        }
      )

      if (geminiResponse.status === 429) {
        console.warn(`Rate limited on ${model}, trying next model...`)
        lastError = 'הגעת למגבלת הבקשות. המתן דקה ונסה שוב.'
        // Wait 2 seconds before trying next model
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }

      if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text()
        console.error(`Gemini API error (${model}):`, geminiResponse.status, errorBody)
        lastError = `שגיאה מ-Gemini API (${geminiResponse.status})`
        continue
      }

      const geminiData = await geminiResponse.json()

      // Extract the text response
      const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
      if (!textResponse) {
        console.error('Empty response from Gemini')
        lastError = 'לא הצלחנו לחלץ מידע מהתמונה'
        continue
      }

      // Parse the JSON response - handle potential markdown code fences and mixed text
      let invoiceData
      try {
        let cleanedResponse = textResponse
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim()

        // Try to find JSON object in the response if it's mixed with text
        if (!cleanedResponse.startsWith('{')) {
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}?/)
          if (jsonMatch) {
            cleanedResponse = jsonMatch[0]
          }
        }

        // Handle truncated JSON - try to close open brackets
        try {
          invoiceData = JSON.parse(cleanedResponse)
        } catch {
          // Try to fix truncated JSON by closing open brackets/braces
          let fixed = cleanedResponse

          // Cut off the last incomplete line/value
          fixed = fixed.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '')
          fixed = fixed.replace(/,\s*\{[^}]*$/, '')
          fixed = fixed.replace(/,\s*$/, '')

          const openBraces = (fixed.match(/\{/g) || []).length
          const closeBraces = (fixed.match(/\}/g) || []).length
          const openBrackets = (fixed.match(/\[/g) || []).length
          const closeBrackets = (fixed.match(/\]/g) || []).length

          for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']'
          for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}'

          invoiceData = JSON.parse(fixed)
          console.log('Fixed truncated JSON successfully')
        }
      } catch (parseError) {
        console.error('Failed to parse Gemini response. Raw text:', textResponse.substring(0, 500))
        lastError = 'לא הצלחנו לפענח את נתוני החשבונית'
        continue
      }

      console.log('Invoice data extracted successfully using', model)
      return NextResponse.json({
        success: true,
        data: invoiceData,
      })
    }

    // All models failed
    return NextResponse.json(
      { error: lastError || 'שגיאה בעיבוד החשבונית' },
      { status: 500 }
    )
  } catch (error) {
    console.error('OCR processing error:', error)
    return NextResponse.json(
      { error: 'שגיאה בעיבוד החשבונית' },
      { status: 500 }
    )
  }
}
