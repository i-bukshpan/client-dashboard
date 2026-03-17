/**
 * Fetches and parses a public Google Sheets link as CSV.
 * The link can be a regular share link or a "publish to web" link.
 */
export async function fetchGoogleSheetData(url: string) {
    try {
        let fetchUrl = url

        // Transform standard share link to CSV export link
        if (url.includes('docs.google.com/spreadsheets/d/')) {
            const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
            if (idMatch && idMatch[1]) {
                const sheetId = idMatch[1]
                // We use the export?format=csv endpoint
                fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
            }
        }

        const response = await fetch(fetchUrl)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        
        const csvText = await response.text()

        // Simple CSV parser for better data interpretation
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        if (lines.length === 0) throw new Error('הקובץ ריק')

        const header = lines[0]
        
        // Return first 100 lines instead of 50 for more context if needed
        const dataRows = lines.slice(1, 101)
        const sample = dataRows.join('\n')

        return {
            success: true,
            raw: csvText,
            condensed: `קובץ גוגל שיטס. \nכותרות: ${header}\nנתונים (עד 100 שורות ראשונות):\n${sample}`,
            rowCount: lines.length - 1,
            columnCount: header.split(',').length
        }
    } catch (error: any) {
        console.error('Error fetching Google Sheet:', error)
        return { success: false, error: error.message }
    }
}
