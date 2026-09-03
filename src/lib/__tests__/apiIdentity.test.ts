import type { AuthResult, AuthSession } from '@spark/types'

import { ApiIdentity } from '../apiIdentity'
import * as authApi from '../authApi'
import { registerForPushNotificationsAsync } from '../pushNotifications'
import { clearSession, readSession, writeSession } from '../secureSession'

jest.mock('../authApi')
jest.mock('../secureSession')
jest.mock('../pushNotifications')
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB' }],
}))
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }))

const mockedRegisterForPush = registerForPushNotificationsAsync as jest.Mock

const mockedRefresh = authApi.refresh as jest.Mock
const mockedUpdateMobileProfile = authApi.updateMobileProfile as jest.Mock
const mockedReadSession = readSession as jest.Mock
const mockedWriteSession = writeSession as jest.Mock
const mockedClearSession = clearSession as jest.Mock

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 900_000,
    user: { id: 'u1', email: 'driver@example.com', role: 'user', emailVerified: true },
    ...overrides,
  }
}

async function restoredIdentity(stored: AuthSession | null): Promise<ApiIdentity> {
  mockedReadSession.mockResolvedValue(stored)
  mockedWriteSession.mockResolvedValue(undefined)
  mockedClearSession.mockResolvedValue(undefined)
  // adopt() reports locale/appVersion on every sign-in, sign-up and refresh — fire-and-
  // forget, but still a real call every one of those paths makes.
  mockedUpdateMobileProfile.mockResolvedValue(undefined)
  const identity = new ApiIdentity()
  await identity.restore()
  return identity
}

describe('concurrent 401 recovery', () => {
  it('collapses N simultaneous refreshes into exactly one call, resolving all callers', async () => {
    const identity = await restoredIdentity(session())
    let resolveRefresh!: (result: AuthResult) => void
    mockedRefresh.mockReturnValue(
      new Promise<AuthResult>((resolve) => {
        resolveRefresh = resolve
      }),
    )

    const calls = [
      identity.recoverFromUnauthorized(),
      identity.recoverFromUnauthorized(),
      identity.recoverFromUnauthorized(),
      identity.recoverFromUnauthorized(),
      identity.recoverFromUnauthorized(),
    ]

    resolveRefresh({ session: session({ accessToken: 'access-2', refreshToken: 'refresh-2' }) })
    const results = await Promise.all(calls)

    expect(results).toEqual([true, true, true, true, true])
    expect(mockedRefresh).toHaveBeenCalledTimes(1)
  })

  it('serves a second wave of 401s with a new refresh once the first has settled', async () => {
    const identity = await restoredIdentity(session())
    mockedRefresh.mockResolvedValue({
      session: session({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    })

    await Promise.all([identity.recoverFromUnauthorized(), identity.recoverFromUnauthorized()])
    await identity.recoverFromUnauthorized()

    expect(mockedRefresh).toHaveBeenCalledTimes(2)
  })
})

describe('failed refresh', () => {
  it('clears the session and does not loop on repeated calls', async () => {
    const identity = await restoredIdentity(session())
    mockedRefresh.mockRejectedValue(new Error('refresh token revoked'))

    const first = await identity.recoverFromUnauthorized()
    expect(first).toBe(false)
    expect(mockedClearSession).toHaveBeenCalledTimes(1)
    expect(identity.getSnapshot()).toEqual({ status: 'anonymous', user: null })

    const second = await identity.recoverFromUnauthorized()
    expect(second).toBe(false)
    // No session left to refresh, so the second call must not spend another attempt.
    expect(mockedRefresh).toHaveBeenCalledTimes(1)
  })

  it('reports no recovery possible when there was never a session', async () => {
    const identity = await restoredIdentity(null)
    const recovered = await identity.recoverFromUnauthorized()
    expect(recovered).toBe(false)
    expect(mockedRefresh).not.toHaveBeenCalled()
  })
})

describe('restore', () => {
  it('publishes anonymous when nothing is stored', async () => {
    const identity = await restoredIdentity(null)
    expect(identity.getSnapshot()).toEqual({ status: 'anonymous', user: null })
    expect(identity.canBook()).toBe(false)
  })

  it('publishes authenticated without refreshing when the token still has time left', async () => {
    const stored = session()
    const identity = await restoredIdentity(stored)
    expect(identity.getSnapshot()).toEqual({ status: 'authenticated', user: stored.user })
    expect(mockedRefresh).not.toHaveBeenCalled()
  })

  it('refreshes eagerly on cold start when the stored token is inside the skew window', async () => {
    const stored = session({ expiresAt: Date.now() + 1_000 })
    mockedRefresh.mockResolvedValue({
      session: session({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    })

    await restoredIdentity(stored)
    expect(mockedRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('authHeaders', () => {
  it('carries the fresh access token as a bearer header', async () => {
    const identity = await restoredIdentity(session({ accessToken: 'access-1' }))
    await expect(identity.authHeaders()).resolves.toEqual({ Authorization: 'Bearer access-1' })
  })

  it('is empty when signed out', async () => {
    const identity = await restoredIdentity(null)
    await expect(identity.authHeaders()).resolves.toEqual({})
  })

  it('transparently refreshes a token inside the skew window before returning it', async () => {
    jest.useFakeTimers()
    const now = Date.now()
    // Far enough out that restore() itself does not consume the refresh: this test targets
    // authHeaders's own skew check, not restore's separate cold-start one.
    const identity = await restoredIdentity(session({ expiresAt: now + 120_000 }))
    mockedRefresh.mockResolvedValue({
      session: session({ accessToken: 'access-fresh', refreshToken: 'refresh-2' }),
    })

    jest.setSystemTime(now + 90_000)

    await expect(identity.authHeaders()).resolves.toEqual({ Authorization: 'Bearer access-fresh' })
    jest.useRealTimers()
  })
})

describe('adopt', () => {
  it('persists the session best-effort: a keystore write failure does not reject signIn', async () => {
    const identity = await restoredIdentity(null)
    mockedWriteSession.mockRejectedValue(new Error('keystore full'))
    ;(authApi.signIn as jest.Mock).mockResolvedValue({ session: session() })

    await expect(
      identity.signIn({ email: 'driver@example.com', password: 'hunter2' }),
    ).resolves.toBeUndefined()
    expect(identity.getSnapshot().status).toBe('authenticated')
  })

  it('reports locale and app version — needs no permission, unlike the push token', async () => {
    const identity = await restoredIdentity(null)
    ;(authApi.signIn as jest.Mock).mockResolvedValue({ session: session() })

    await identity.signIn({ email: 'driver@example.com', password: 'hunter2' })

    expect(mockedUpdateMobileProfile).toHaveBeenCalledWith('access-1', {
      locale: 'en-GB',
      appVersion: '1.0.0',
    })
  })

  it('does not let a mobile-profile report failure reject sign-in', async () => {
    const identity = await restoredIdentity(null)
    mockedUpdateMobileProfile.mockRejectedValue(new Error('offline'))
    ;(authApi.signIn as jest.Mock).mockResolvedValue({ session: session() })

    await expect(
      identity.signIn({ email: 'driver@example.com', password: 'hunter2' }),
    ).resolves.toBeUndefined()
  })
})

describe('enableNotifications', () => {
  it('reports false without registering anything when signed out', async () => {
    const identity = await restoredIdentity(null)

    await expect(identity.enableNotifications()).resolves.toBe(false)
    expect(mockedRegisterForPush).not.toHaveBeenCalled()
  })

  it('reports false and writes nothing when permission is denied (or there is no device)', async () => {
    const identity = await restoredIdentity(session())
    mockedRegisterForPush.mockResolvedValue(null)
    mockedUpdateMobileProfile.mockClear()

    await expect(identity.enableNotifications()).resolves.toBe(false)
    expect(mockedUpdateMobileProfile).not.toHaveBeenCalled()
  })

  it('registers the Expo push token against the account once permission is granted', async () => {
    const identity = await restoredIdentity(session({ accessToken: 'access-1' }))
    mockedRegisterForPush.mockResolvedValue('ExponentPushToken[abc]')
    mockedUpdateMobileProfile.mockClear()

    await expect(identity.enableNotifications()).resolves.toBe(true)
    expect(mockedUpdateMobileProfile).toHaveBeenCalledWith('access-1', {
      pushToken: 'ExponentPushToken[abc]',
    })
  })
})
