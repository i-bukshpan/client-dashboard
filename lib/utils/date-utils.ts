/**
 * Date utility functions for CSV import/export
 * Provides consistent date formatting and parsing for DD/MM/YYYY format
 */

/**
 * Format a date for CSV export in DD/MM/YYYY format
 * @param date - Date object, ISO string, or null
 * @returns Formatted date string in DD/MM/YYYY format, or empty string if invalid
 */
export function formatDateForCSV(date: Date | string | null | undefined): string {
    if (!date) return ''

    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date

        // Validate date
        if (isNaN(dateObj.getTime())) {
            return ''
        }

        const day = String(dateObj.getDate()).padStart(2, '0')
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const year = dateObj.getFullYear()

        return `${day}/${month}/${year}`
    } catch (error) {
        console.error('Error formatting date for CSV:', error)
        return ''
    }
}

/**
 * Parse a date from CSV import
 * Supports multiple formats: DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD (ISO)
 * @param dateString - Date string from CSV
 * @returns Date object or null if invalid
 */
export function parseDateFromCSV(dateString: string | null | undefined): Date | null {
    if (!dateString || typeof dateString !== 'string') return null

    const trimmed = dateString.trim()
    if (!trimmed) return null

    try {
        // Try DD/MM/YYYY format (with slashes)
        const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (slashMatch) {
            const [, day, month, year] = slashMatch
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

            // Validate the date is correct (handles invalid dates like 31/02/2024)
            if (
                date.getDate() === parseInt(day) &&
                date.getMonth() === parseInt(month) - 1 &&
                date.getFullYear() === parseInt(year)
            ) {
                return date
            }
        }

        // Try DD.MM.YYYY format (with dots)
        const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
        if (dotMatch) {
            const [, day, month, year] = dotMatch
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

            if (
                date.getDate() === parseInt(day) &&
                date.getMonth() === parseInt(month) - 1 &&
                date.getFullYear() === parseInt(year)
            ) {
                return date
            }
        }

        // Try ISO format or other standard formats
        const date = new Date(trimmed)
        if (!isNaN(date.getTime())) {
            return date
        }

        return null
    } catch (error) {
        console.error('Error parsing date from CSV:', error)
        return null
    }
}

/**
 * Format a date and time for CSV export in DD/MM/YYYY HH:MM format
 * @param date - Date object, ISO string, or null
 * @returns Formatted datetime string, or empty string if invalid
 */
export function formatDateTimeForCSV(date: Date | string | null | undefined): string {
    if (!date) return ''

    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date

        if (isNaN(dateObj.getTime())) {
            return ''
        }

        const day = String(dateObj.getDate()).padStart(2, '0')
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const year = dateObj.getFullYear()
        const hours = String(dateObj.getHours()).padStart(2, '0')
        const minutes = String(dateObj.getMinutes()).padStart(2, '0')

        return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch (error) {
        console.error('Error formatting datetime for CSV:', error)
        return ''
    }
}
