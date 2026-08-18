import type { AuthSession } from '@spark/types'
import * as SecureStore from 'expo-secure-store'

import { clearSession, readSession, writeSession } from '../secureSession'

const mockedGetItem = SecureStore.getItemAsync as jest.Mock
const mockedSetItem = SecureStore.setItemAsync as jest.Mock
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock

const validSession: AuthSession = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 900_000,
  user: {
    id: 'user-1',
    email: 'driver@example.com',
    role: 'user',
    emailVerified: true,
  },
}

describe('readSession', () => {
  it('returns null when nothing is stored', async () => {
    mockedGetItem.mockResolvedValue(null)
    await expect(readSession()).resolves.toBeNull()
  })

  it('returns null when the keystore read rejects', async () => {
    mockedGetItem.mockRejectedValue(new Error('keystore unavailable'))
    await expect(readSession()).resolves.toBeNull()
  })

  it('returns the parsed session when the stored entry is valid', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify(validSession))
    await expect(readSession()).resolves.toEqual(validSession)
  })

  it('degrades to signed-out on unparsable JSON', async () => {
    mockedGetItem.mockResolvedValue('{not json')
    await expect(readSession()).resolves.toBeNull()
  })

  it('degrades to signed-out when a required field is missing', async () => {
    const { user, ...rest } = validSession
    const { email, ...userWithoutEmail } = user
    mockedGetItem.mockResolvedValue(JSON.stringify({ ...rest, user: userWithoutEmail }))
    await expect(readSession()).resolves.toBeNull()
  })

  it('degrades to signed-out when the role is not one of the known values', async () => {
    mockedGetItem.mockResolvedValue(
      // Deliberately a role that does not exist. It used to be 'super_admin', which stopped
      // being unknown the moment that tier shipped — leaving the assertion true only because
      // the schema was stale, which is the opposite of what this test is for.
      JSON.stringify({ ...validSession, user: { ...validSession.user, role: 'archivist' } }),
    )
    await expect(readSession()).resolves.toBeNull()
  })

  it('degrades to signed-out on a partial write (e.g. truncated by a crash)', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify({ accessToken: 'only-this-field' }))
    await expect(readSession()).resolves.toBeNull()
  })
})

describe('writeSession', () => {
  it('serialises the full session under the fixed key', async () => {
    await writeSession(validSession)
    expect(mockedSetItem).toHaveBeenCalledWith('spark-auth-session', JSON.stringify(validSession))
  })
})

describe('clearSession', () => {
  it('deletes the fixed key', async () => {
    await clearSession()
    expect(mockedDeleteItem).toHaveBeenCalledWith('spark-auth-session')
  })
})
