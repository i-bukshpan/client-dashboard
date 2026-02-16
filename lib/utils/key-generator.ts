/**
 * Utility function to generate a valid JSON key from Hebrew text
 * Converts Hebrew text to English key (lowercase, spaces to underscores)
 */

export function generateKeyFromHebrew(hebrewText: string): string {
  // Remove leading/trailing whitespace
  const trimmed = hebrewText.trim()
  
  if (!trimmed) return ''
  
  // Create a mapping of common Hebrew words to English equivalents
  // This is a simple mapping - for production, you might want a more sophisticated solution
  const commonMappings: Record<string, string> = {
    'תאריך': 'date',
    'תיאור': 'description',
    'הכנסה': 'income',
    'הוצאה': 'expense',
    'קטגוריה': 'category',
    'יתרה': 'balance',
    'סכום': 'amount',
    'שם': 'name',
    'סוג': 'type',
    'מחיר': 'price',
    'כמות': 'quantity',
    'סטטוס': 'status',
    'שם סופר': 'scribe_name',
    'סוג מגילה': 'scroll_type',
  }
  
  // Check if there's a direct mapping
  const lowerHebrew = trimmed.toLowerCase()
  if (commonMappings[lowerHebrew]) {
    return commonMappings[lowerHebrew]
  }
  
  // Try to transliterate Hebrew characters to English
  // This is a basic implementation - you might want to use a library for better transliteration
  const transliteration: Record<string, string> = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ל': 'l', 'מ': 'm', 'נ': 'n',
    'ס': 's', 'ע': 'a', 'פ': 'p', 'צ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh',
    'ת': 't'
  }
  
  // For now, use a simple approach: convert spaces to underscores and use a hash-based approach
  // or use the first few characters of transliteration
  let result = ''
  for (let i = 0; i < trimmed.length && i < 20; i++) {
    const char = trimmed[i]
    if (char === ' ') {
      if (result && result[result.length - 1] !== '_') {
        result += '_'
      }
    } else if (transliteration[char]) {
      result += transliteration[char]
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char.toLowerCase()
    } else if (result && result[result.length - 1] !== '_') {
      result += '_'
    }
  }
  
  // Clean up: remove trailing underscores, ensure it starts with a letter
  result = result.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  
  // If result is empty or doesn't start with a letter, use a fallback
  if (!result || !/^[a-z]/.test(result)) {
    // Use a simple hash-based approach as fallback
    result = 'field_' + Math.abs(trimmed.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0)).toString(36).substring(0, 10)
  }
  
  return result || 'field'
}

/**
 * Generate a unique key from a label, ensuring it doesn't conflict with existing keys
 */
export function generateUniqueKey(label: string, existingKeys: string[]): string {
  let baseKey = generateKeyFromHebrew(label)
  let uniqueKey = baseKey
  let counter = 1
  
  while (existingKeys.includes(uniqueKey)) {
    uniqueKey = `${baseKey}_${counter}`
    counter++
  }
  
  return uniqueKey
}

