import type { AuthSession, UserRole } from '@spark/types'
import * as SecureStore from 'expo-secure-store'
import { z } from 'zod'

// Encrypted keystore, never AsyncStorage: the refresh token is a 30-day credential and
// AsyncStorage is plaintext on disk.
const SESSION_KEY = 'spark-auth-session'

// `satisfies` checks assignability, not exhaustiveness, so adding a UserRole does NOT fail
// the build here — it silently makes sessions for that role fail validation and degrade to
// signed-out. Any new role must be added by hand.
const USER_ROLES = [
  'guest',
  'user',
  'operator_staff',
  'operator_admin',
  'platform_admin',
  'super_admin',
] as const satisfies readonly UserRole[]

// Re-validated on read: an entry written by an older build (or a partial write) must
// degrade to signed-out rather than crash a screen reading `user.email`.
const storedSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  user: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
    role: z.enum(USER_ROLES),
    emailVerified: z.boolean(),
    displayName: z.string().optional(),
    avatarUrl: z.string().optional(),
  }),
})

export async function readSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null)
  if (!raw) return null

  try {
    const parsed = storedSessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeSession(session: AuthSession): Promise<void> {
  return SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): Promise<void> {
  return SecureStore.deleteItemAsync(SESSION_KEY)
}
