/**
 * Simple encryption utilities for storing passwords
 * Note: This is a basic implementation. For production, consider using a more robust solution.
 */

/**
 * Encrypts a password using a simple base64 encoding
 * In production, use a proper encryption library like crypto-js or node:crypto
 * 
 * @param password - The plain text password
 * @param secretKey - Optional secret key (in production, store this securely)
 * @returns Encrypted password string
 */
export function encryptPassword(password: string, secretKey: string = 'default-secret-key'): string {
  // Simple XOR encryption (for demonstration)
  // In production, use proper encryption like AES-256
  if (!password) return ''
  
  let encrypted = ''
  for (let i = 0; i < password.length; i++) {
    const charCode = password.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length)
    encrypted += String.fromCharCode(charCode)
  }
  
  // Convert to base64 for storage
  if (typeof window !== 'undefined') {
    // Client-side
    return btoa(encrypted)
  } else {
    // Server-side
    return Buffer.from(encrypted).toString('base64')
  }
}

/**
 * Decrypts a password
 * 
 * @param encryptedPassword - The encrypted password
 * @param secretKey - The secret key used for encryption
 * @returns Decrypted password string
 */
export function decryptPassword(encryptedPassword: string, secretKey: string = 'default-secret-key'): string {
  if (!encryptedPassword) return ''
  
  try {
    // Decode from base64
    let decrypted = ''
    if (typeof window !== 'undefined') {
      // Client-side
      decrypted = atob(encryptedPassword)
    } else {
      // Server-side
      decrypted = Buffer.from(encryptedPassword, 'base64').toString('utf-8')
    }
    
    // Reverse XOR
    let password = ''
    for (let i = 0; i < decrypted.length; i++) {
      const charCode = decrypted.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length)
      password += String.fromCharCode(charCode)
    }
    
    return password
  } catch (error) {
    console.error('Error decrypting password:', error)
    return ''
  }
}

/**
 * Get secret key from environment or use default
 * In production, this should be stored securely (environment variable, secret manager, etc.)
 */
export function getSecretKey(): string {
  return process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-secret-key-change-in-production'
}

