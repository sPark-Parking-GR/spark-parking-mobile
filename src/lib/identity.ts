import type { AuthUser, SignInCredentials } from '@spark/types'

import { ApiIdentity } from './apiIdentity'
import type { SignUpRequest } from './authApi'

export interface IdentityStrategy {
  authHeaders(): Promise<Record<string, string>>
  canBook(): boolean
  // Called once after a 401. Resolves true when a fresh token is in place and the caller
  // may retry, false when the identity has dropped to signed-out.
  recoverFromUnauthorized(): Promise<boolean>
}

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated'

export interface AuthSnapshot {
  status: AuthStatus
  user: AuthUser | null
}

// The session lifecycle the app root drives, kept apart from IdentityStrategy so request
// code keeps depending only on the narrow "how do I authenticate this call" seam.
export interface SessionIdentity extends IdentityStrategy {
  subscribe(listener: () => void): () => void
  getSnapshot(): AuthSnapshot
  restore(): Promise<void>
  signIn(credentials: SignInCredentials): Promise<void>
  signUp(data: SignUpRequest): Promise<void>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  // Erases the account server-side and drops to signed-out. Rejects — leaving the session
  // untouched — when the password is wrong or the account still has a booking to settle.
  deleteAccount(password: string): Promise<void>
  // Requests notification permission (a no-op if already decided) and, if granted,
  // registers the resulting Expo push token against the account. Resolves false rather
  // than rejecting on a denied permission — that is an expected outcome, not a failure.
  enableNotifications(): Promise<boolean>
}

const SIGNED_OUT: AuthSnapshot = { status: 'anonymous', user: null }

const AUTH_DISABLED = 'Authentication is not enabled in this build'

export class AnonymousIdentity implements SessionIdentity {
  async authHeaders(): Promise<Record<string, string>> {
    return {}
  }

  canBook(): boolean {
    return false
  }

  async recoverFromUnauthorized(): Promise<boolean> {
    return false
  }

  subscribe(): () => void {
    return () => undefined
  }

  getSnapshot(): AuthSnapshot {
    return SIGNED_OUT
  }

  restore(): Promise<void> {
    return Promise.resolve()
  }

  signIn(): Promise<void> {
    return Promise.reject(new Error(AUTH_DISABLED))
  }

  signUp(): Promise<void> {
    return Promise.reject(new Error(AUTH_DISABLED))
  }

  signOut(): Promise<void> {
    return Promise.resolve()
  }

  requestPasswordReset(): Promise<void> {
    return Promise.reject(new Error(AUTH_DISABLED))
  }

  deleteAccount(): Promise<void> {
    return Promise.reject(new Error(AUTH_DISABLED))
  }

  enableNotifications(): Promise<boolean> {
    return Promise.resolve(false)
  }
}

export type IdentityConfig = { kind: 'anonymous' } | { kind: 'api' }

export function createIdentity(config: IdentityConfig): SessionIdentity {
  switch (config.kind) {
    case 'anonymous':
      return new AnonymousIdentity()
    case 'api':
      return new ApiIdentity()
  }
}

// Consumers are authjs-backed accounts created through our own `POST /auth/sign-up`, so
// the API mints and verifies the tokens itself — there is no provider SDK to select.
function getIdentityConfig(): IdentityConfig {
  return { kind: 'api' }
}

export const identity: SessionIdentity = createIdentity(getIdentityConfig())
