import bcrypt from 'bcryptjs'
import { db } from '../db/db'

const SALT_ROUNDS = 10

/**
 * Hash a password and store it in settings
 */
export async function setPassword(password: string): Promise<void> {
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  await db.settings.put({ key: 'passwordHash', value: hash })
}

/**
 * Verify a password against the stored hash
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const setting = await db.settings.get('passwordHash')
  if (!setting || !setting.value) {
    // No password set — first time setup
    return true
  }
  return bcrypt.compare(password, setting.value as string)
}

/**
 * Check if a password has been set
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
