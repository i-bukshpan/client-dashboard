/**
 * Utility functions for WhatsApp integration
 */

/**
 * Cleans and formats a phone number for WhatsApp
 * Removes dashes, spaces, and ensures it starts with country code (972 for Israel)
 * 
 * @param phoneNumber - The phone number to clean (e.g., "050-123-4567" or "0501234567")
 * @returns Formatted phone number with country code (e.g., "972501234567")
 */
export function formatPhoneForWhatsApp(phoneNumber: string): string {
  if (!phoneNumber) return ''
  
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '')
  
  // If it starts with 0, replace with 972 (Israel country code)
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1)
  }
  // If it doesn't start with country code, add 972
  else if (!cleaned.startsWith('972')) {
    cleaned = '972' + cleaned
  }
  
  return cleaned
}

/**
 * Creates a WhatsApp reminder message for a payment
 * 
 * @param clientName - The name of the client
 * @param amount - The payment amount
 * @param dueDate - The due date of the payment
 * @returns Formatted Hebrew message
 */
export function createPaymentReminderMessage(
  clientName: string,
  amount: number,
  dueDate: string
): string {
  const formattedDate = new Date(dueDate).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const formattedAmount = amount.toLocaleString('he-IL')
  
  return `שלום ${clientName}, תזכורת ידידותית לגבי תשלום על סך ₪${formattedAmount} שמועד פירעונו ב-${formattedDate}. נחמיה.`
}

/**
 * Opens WhatsApp with a pre-filled message
 * 
 * @param phoneNumber - The phone number (will be formatted automatically)
 * @param message - The message to send
 */
export function sendWhatsAppMessage(phoneNumber: string, message: string): void {
  const formattedPhone = formatPhoneForWhatsApp(phoneNumber)
  
  if (!formattedPhone) {
    alert('מספר טלפון לא תקין')
    return
  }
  
  // Encode the message for URL
  const encodedMessage = encodeURIComponent(message)
  
  // Create WhatsApp URL
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`
  
  // Open in new tab
  window.open(whatsappUrl, '_blank')
}

/**
 * Sends a WhatsApp reminder for a payment
 * 
 * @param clientName - The name of the client
 * @param amount - The payment amount
 * @param dueDate - The due date of the payment
 * @param phoneNumber - The client's phone number
 */
export function sendWhatsAppReminder(
  clientName: string,
  amount: number,
  dueDate: string,
  phoneNumber: string
): void {
  if (!phoneNumber) {
    alert('אין מספר טלפון ללקוח זה')
    return
  }
  
  const message = createPaymentReminderMessage(clientName, amount, dueDate)
  sendWhatsAppMessage(phoneNumber, message)
}

