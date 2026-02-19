import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { items, targetColumns, referenceData, customPrompt, invoiceMeta, invoiceTotals } = await request.json()

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'אין פריטים לעיבוד' }, { status: 400 })
        }

        if (!targetColumns || !Array.isArray(targetColumns) || targetColumns.length === 0) {
            return NextResponse.json({ error: 'לא נבחרה טבלת יעד' }, { status: 400 })
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'מפתח Gemini API לא מוגדר' }, { status: 500 })
        }

        // Build the target table schema description
        const targetSchemaDesc = targetColumns
            .map((c: any) => `  - "${c.name}" (label: "${c.label}", type: ${c.type})`)
            .join('\n')

        // Build the prompt dynamically
        let prompt = `You are a data processing engine. You receive invoice line items and must output records for a target table.

TARGET TABLE COLUMNS:
${targetSchemaDesc}

INVOICE LINE ITEMS:
${JSON.stringify(items, null, 2)}
`

        if (invoiceMeta) {
            prompt += `\nINVOICE METADATA:
${JSON.stringify(invoiceMeta, null, 2)}
`
        }

        if (invoiceTotals) {
            prompt += `\nINVOICE TOTALS:
${JSON.stringify(invoiceTotals, null, 2)}
`
        }

        if (referenceData && referenceData.length > 0) {
            prompt += `\nREFERENCE DATA (from another table, use for matching/lookup):
${JSON.stringify(referenceData, null, 2)}
`
        }

        if (customPrompt && customPrompt.trim()) {
            prompt += `\nUSER INSTRUCTIONS (follow these carefully):
${customPrompt}
`
        }

        prompt += `
TASK:
Create records for the target table based on the invoice items.
Each record must use ONLY the column names from the TARGET TABLE COLUMNS listed above.
The keys in each record object must be the "name" field (not the "label").

RULES:
- Return ONLY a valid JSON array of objects
- Each object's keys must match the target table column "name" values exactly
- For currency/number columns, use numeric values (not strings)
- For date columns, use YYYY-MM-DD format
- If the user provided instructions, follow them precisely
- If reference data is provided, use it for matching/lookup as instructed
- Do not add keys that don't exist in the target table columns
- No markdown, no explanation, only the JSON array`

        const models = ['gemini-2.0-flash', 'gemini-2.5-flash']
        let lastError = ''

        for (const model of models) {
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
                    }),
                }
            )

            if (geminiResponse.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000))
                continue
            }

            if (!geminiResponse.ok) {
                const errorBody = await geminiResponse.text()
                console.error(`Gemini match error (${model}):`, geminiResponse.status, errorBody)
                lastError = `שגיאה מ-Gemini API (${geminiResponse.status})`
                continue
            }

            const geminiData = await geminiResponse.json()
            const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

            if (!textResponse) {
                lastError = 'לא הצלחנו לנתח את הפריטים'
                continue
            }

            let records
            try {
                let cleaned = textResponse
                    .replace(/```json\s*/g, '')
                    .replace(/```\s*/g, '')
                    .trim()

                // Find array in response
                if (!cleaned.startsWith('[')) {
                    const arrMatch = cleaned.match(/\[[\s\S]*\]?/)
                    if (arrMatch) cleaned = arrMatch[0]
                }

                // Try to fix truncated JSON
                try {
                    records = JSON.parse(cleaned)
                } catch {
                    let fixed = cleaned
                        .replace(/,\s*\{[^}]*$/, '')
                        .replace(/,\s*$/, '')
                    const openBrackets = (fixed.match(/\[/g) || []).length
                    const closeBrackets = (fixed.match(/\]/g) || []).length
                    const openBraces = (fixed.match(/\{/g) || []).length
                    const closeBraces = (fixed.match(/\}/g) || []).length
                    for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}'
                    for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']'
                    records = JSON.parse(fixed)
                    console.log('Fixed truncated JSON in match response')
                }
            } catch {
                console.error('Failed to parse match response:', textResponse.substring(0, 500))
                lastError = 'לא הצלחנו לפענח את תוצאות העיבוד'
                continue
            }

            // Ensure it's an array
            if (!Array.isArray(records)) {
                records = [records]
            }

            console.log(`Successfully matched ${records.length} records using ${model}`)
            return NextResponse.json({ success: true, records })
        }

        return NextResponse.json({ error: lastError || 'שגיאה בעיבוד הפריטים' }, { status: 500 })
    } catch (error) {
        console.error('Data mapping error:', error)
        return NextResponse.json({ error: 'שגיאה בעיבוד הנתונים' }, { status: 500 })
    }
}
