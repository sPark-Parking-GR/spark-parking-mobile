import type { SignInCredentials } from '@spark/types'
import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'

import type { SignUpRequest } from '../lib/authApi'
import type { AuthSnapshot } from '../lib/identity'
import { identity } from '../lib/identity'

export interface AuthContextValue extends AuthSnapshot {
  isAuthenticated: boolean
  signIn: (credentials: SignInCredentials) => Promise<void>
  signUp: (data: SignUpRequest) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function subscribe(listener: () => void): () => void {
  return identity.subscribe(listener)
}

function getSnapshot(): AuthSnapshot {
  return identity.getSnapshot()
}

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  // The strategy owns the session; React only mirrors it, so a token refreshed by a
  // background request repaints the UI without a second source of truth.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    // Status stays 'restoring' until the keystore has been read, so no screen renders a
    // signed-out state that a stored session is about to contradict.
    identity.restore().catch(() => undefined)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      isAuthenticated: snapshot.status === 'authenticated',
      signIn: (credentials) => identity.signIn(credentials),
      signUp: (data) => identity.signUp(data),
      signOut: () => identity.signOut(),
      requestPasswordReset: (email) => identity.requestPasswordReset(email),
      deleteAccount: (password) => identity.deleteAccount(password),
    }),
    [snapshot],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
