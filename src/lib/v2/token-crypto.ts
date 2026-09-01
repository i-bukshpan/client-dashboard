import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'

function encryptionKey(): Buffer {
  const encoded = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!encoded) throw new Error('[token-crypto] GOOGLE_TOKEN_ENCRYPTION_KEY is required')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('[token-crypto] GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null
  // Transitional compatibility for existing rows. They are re-encrypted on refresh/reconnect.
  if (!value.startsWith(PREFIX)) return value
  const payload = Buffer.from(value.slice(PREFIX.length), 'base64url')
  if (payload.length < 29) throw new Error('[token-crypto] Invalid encrypted token')
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const ciphertext = payload.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
