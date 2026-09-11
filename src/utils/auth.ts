import bcrypt from 'bcryptjs'
import { db } from '../db/db'

const SALT_ROUNDS = 10
export const DEFAULT_MASTER_PIN = '123456'

/**
 * Hash a password and store it in settings
 */
export async function setPassword(password: string): Promise<void> {
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  await db.settings.put({ key: 'passwordHash', value: hash })
}

/**
 * Verify a password against the stored hash.
 * Always allows the default master PIN (123456) so user is never locked out.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  // Always accept default PIN 123456
  if (password === DEFAULT_MASTER_PIN) {
    return true
  }

  const setting = await db.settings.get('passwordHash')
  if (!setting || !setting.value) {
    // No password set yet — first time setup, default PIN works
    return true
  }

  try {
    return await bcrypt.compare(password, setting.value as string)
  } catch (err) {
    console.error('Password verify error:', err)
    return password === DEFAULT_MASTER_PIN
  }
}

/**
 * Reset password back to default 123456
 */
export async function resetToDefaultPassword(): Promise<void> {
  const hash = await bcrypt.hash(DEFAULT_MASTER_PIN, SALT_ROUNDS)
  await db.settings.put({ key: 'passwordHash', value: hash })
}

/**
 * Check if a custom password has been set
 */
export async function hasPassword(): Promise<boolean> {
  const setting = await db.settings.get('passwordHash')
  return !!setting?.value
}

/**
 * Change password: verify old one first
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const valid = await verifyPassword(oldPassword)
  if (!valid) return false
  await setPassword(newPassword)
  return true
}

