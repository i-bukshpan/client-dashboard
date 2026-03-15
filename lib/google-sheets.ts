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

        // Return a condensed version for AI context (first 50 lines)
        const lines = csvText.split('\n')
        const header = lines[0]
        const sample = lines.slice(1, 51).join('\n')

        return {
            success: true,
            raw: csvText,
            condensed: `Header: ${header}\nSample Data:\n${sample}`,
            rowCount: lines.length - 1
        }
    } catch (error: any) {
        console.error('Error fetching Google Sheet:', error)
        return { success: false, error: error.message }
    }
}
