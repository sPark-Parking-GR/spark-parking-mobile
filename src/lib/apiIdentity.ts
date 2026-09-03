import type { AuthSession, SignInCredentials } from '@spark/types'
import Constants from 'expo-constants'
import { getLocales } from 'expo-localization'

import * as authApi from './authApi'
import type { SignUpRequest } from './authApi'
import type { AuthSnapshot, SessionIdentity } from './identity'
import { registerForPushNotificationsAsync } from './pushNotifications'
import { clearSession, readSession, writeSession } from './secureSession'

// Access tokens live 15 minutes; renew inside the last minute so a request that is
// about to be sent never carries a token that expires in flight.
const REFRESH_SKEW_MS = 60_000

const SIGNED_OUT: AuthSnapshot = { status: 'anonymous', user: null }

const SESSION_EXPIRED = 'Your session has expired. Sign in again.'

export class ApiIdentity implements SessionIdentity {
  private session: AuthSession | null = null
  private snapshot: AuthSnapshot = { status: 'restoring', user: null }
  private readonly listeners = new Set<() => void>()
  private refreshing: Promise<AuthSession | null> | null = null

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): AuthSnapshot {
    return this.snapshot
  }

  canBook(): boolean {
    return this.session !== null
  }

  async authHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.currentAccessToken()
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  }

  async recoverFromUnauthorized(): Promise<boolean> {
    if (!this.session) return false
    return (await this.refreshOnce()) !== null
  }

  async restore(): Promise<void> {
    const stored = await readSession()
    if (!stored) {
      this.publish(SIGNED_OUT)
      return
    }

    this.session = stored
    this.publish({ status: 'authenticated', user: stored.user })

    // Cold start after more than 15 minutes away is the common case, so settle the real
    // state now instead of letting the first booking tap pay for it.
    if (stored.expiresAt - Date.now() <= REFRESH_SKEW_MS) await this.refreshOnce()
  }

  async signIn(credentials: SignInCredentials): Promise<void> {
    const { session } = await authApi.signIn(credentials)
    await this.adopt(session)
  }

  async signUp(data: SignUpRequest): Promise<void> {
    const { session } = await authApi.signUp(data)
    await this.adopt(session)
  }

  async signOut(): Promise<void> {
    const accessToken = this.session?.accessToken
    // Drop local state whatever the server answers: staying visibly signed in holding
    // credentials we have already stopped trusting is the worse outcome.
    if (accessToken) await authApi.signOut(accessToken).catch(() => undefined)
    await this.forget()
  }

  requestPasswordReset(email: string): Promise<void> {
    return authApi.forgotPassword(email)
  }

  // The local session is dropped only once the server has confirmed the account is gone:
  // a wrong password or an unsettled booking comes back as an error the caller shows, with
  // the user still signed in and able to act on it.
  async deleteAccount(password: string): Promise<void> {
    const accessToken = await this.currentAccessToken()
    if (!accessToken) throw new Error(SESSION_EXPIRED)

    await authApi.deleteAccount(accessToken, password)
    await this.forget()
  }

  async enableNotifications(): Promise<boolean> {
    const accessToken = await this.currentAccessToken()
    if (!accessToken) return false

    const pushToken = await registerForPushNotificationsAsync()
    if (!pushToken) return false

    await authApi.updateMobileProfile(accessToken, { pushToken })
    return true
  }

  private async currentAccessToken(): Promise<string | null> {
    const current = this.session
    if (!current) return null

    const session =
      current.expiresAt - Date.now() > REFRESH_SKEW_MS ? current : await this.refreshOnce()

    return session?.accessToken ?? null
  }

  // Every caller shares one in-flight refresh. The API rotates the refresh token on use,
  // so N concurrent 401s each spending the stored token would destroy the very session
  // they were trying to renew.
  private refreshOnce(): Promise<AuthSession | null> {
    this.refreshing ??= this.runRefresh().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private async runRefresh(): Promise<AuthSession | null> {
    const refreshToken = this.session?.refreshToken
    if (!refreshToken) return null

    try {
      const { session } = await authApi.refresh(refreshToken)
      await this.adopt(session)
      return session
    } catch {
      // The refresh token is spent, revoked or 30 days old. Drop to signed-out rather
      // than retry against a credential that can no longer succeed.
      await this.forget()
      return null
    }
  }

  private async adopt(session: AuthSession): Promise<void> {
    this.session = session
    this.publish({ status: 'authenticated', user: session.user })
    // Best effort: a keystore write failure must not fail the sign-in, nor the refresh
    // that is unblocking an in-flight booking.
    await writeSession(session).catch(() => undefined)
    // Fire-and-forget: needs no permission, so it happens on every sign-in, sign-up and
    // token refresh rather than waiting on the (opt-in, permission-gated) push token.
    this.reportMobileProfile(session.accessToken).catch(() => undefined)
  }

  private reportMobileProfile(accessToken: string): Promise<void> {
    const locale = getLocales()[0]?.languageTag
    const appVersion = Constants.expoConfig?.version
    return authApi
      .updateMobileProfile(accessToken, {
        ...(locale ? { locale } : {}),
        ...(appVersion ? { appVersion } : {}),
      })
      .catch(() => undefined)
  }

  private async forget(): Promise<void> {
    this.session = null
    this.publish(SIGNED_OUT)
    await clearSession().catch(() => undefined)
  }

  private publish(snapshot: AuthSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
