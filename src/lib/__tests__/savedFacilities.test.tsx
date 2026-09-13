import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { useAuth } from '../../auth/AuthProvider'
import type { RemoteSavedFacility } from '../api'
import { listSavedFacilities, saveFacility } from '../api'
import type { SavedFacility } from '../savedFacilities'
import { SavedFacilitiesProvider, useSavedFacilities } from '../savedFacilities'

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }))
jest.mock('../api', () => ({
  listSavedFacilities: jest.fn(),
  saveFacility: jest.fn(),
  unsaveFacility: jest.fn(),
}))

const mockedUseAuth = useAuth as jest.Mock
const mockedList = listSavedFacilities as jest.Mock<Promise<RemoteSavedFacility[]>>
const mockedSave = saveFacility as jest.Mock<Promise<void>>

function asUser(id: string): void {
  mockedUseAuth.mockReturnValue({ user: { id } })
}

function asGuest(): void {
  mockedUseAuth.mockReturnValue({ user: null })
}

function cachedFacility(id: string): SavedFacility {
  return { id, name: 'Central Parking', address: '1 Main St', available: true }
}

function wrapper({ children }: { children: ReactNode }) {
  return <SavedFacilitiesProvider>{children}</SavedFacilitiesProvider>
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('cache-first read-through', () => {
  it('keeps serving the cache when the remote refresh fails', async () => {
    await AsyncStorage.setItem('spark-saved-facilities:u1', JSON.stringify([cachedFacility('f1')]))
    asUser('u1')
    mockedList.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()

    expect(result.current.saved).toEqual([cachedFacility('f1')])
  })

  it('falls back to the cache when an explicit reload fails', async () => {
    await AsyncStorage.setItem('spark-saved-facilities:u1', JSON.stringify([cachedFacility('f1')]))
    asUser('u1')
    mockedList.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()

    act(() => {
      result.current.reload()
    })
    await flush()

    expect(result.current.saved).toEqual([cachedFacility('f1')])
  })
})

describe('per-account cache isolation', () => {
  it('does not let a second user read the first user’s saved facilities', async () => {
    await AsyncStorage.setItem('spark-saved-facilities:u1', JSON.stringify([cachedFacility('f1')]))
    asUser('u2')
    mockedList.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()

    expect(result.current.saved).toEqual([])
  })
})

describe('toggleSaved', () => {
  it('applies the star optimistically before the network call settles', async () => {
    asUser('u1')
    mockedList.mockResolvedValue([])
    let resolveSave!: () => void
    mockedSave.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve
      }),
    )

    const { result } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()

    act(() => {
      result.current.toggleSaved({
        id: 'f2',
        name: 'Airport Parking',
        address: '2 Airport Rd',
        available: true,
      })
    })

    expect(result.current.isSaved('f2')).toBe(true)
    expect(mockedSave).toHaveBeenCalledWith('f2', expect.anything())

    resolveSave()
    await flush()
    expect(result.current.isSaved('f2')).toBe(true)
  })
})

describe('guest favourites', () => {
  it('reads the local guest list without ever calling the server', async () => {
    await AsyncStorage.setItem(
      'spark-saved-facilities:guest',
      JSON.stringify([cachedFacility('f1')]),
    )
    asGuest()

    const { result } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()

    expect(result.current.saved).toEqual([cachedFacility('f1')])
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('saves and unsaves locally with no network call', async () => {
    asGuest()

    const { result } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()

    act(() => {
      result.current.toggleSaved(cachedFacility('f1'))
    })

    expect(result.current.isSaved('f1')).toBe(true)
    expect(mockedSave).not.toHaveBeenCalled()

    const stored = await AsyncStorage.getItem('spark-saved-facilities:guest')
    expect(JSON.parse(stored!)).toEqual([cachedFacility('f1')])

    act(() => {
      result.current.toggleSaved(cachedFacility('f1'))
    })

    expect(result.current.isSaved('f1')).toBe(false)
  })

  it('pushes guest favourites to the account and clears the guest slot on sign-in', async () => {
    await AsyncStorage.setItem(
      'spark-saved-facilities:guest',
      JSON.stringify([cachedFacility('f1')]),
    )
    asGuest()
    mockedList.mockResolvedValue([
      { facilityId: 'f1', name: 'Central Parking', address: '1 Main St', available: true },
    ])

    const { result, rerender } = renderHook(() => useSavedFacilities(), { wrapper })
    await flush()
    expect(result.current.saved).toEqual([cachedFacility('f1')])

    asUser('u1')
    rerender()
    await flush()

    expect(mockedSave).toHaveBeenCalledWith('f1', expect.anything())
    expect(await AsyncStorage.getItem('spark-saved-facilities:guest')).toBeNull()
    expect(result.current.saved).toEqual([cachedFacility('f1')])
  })
})
