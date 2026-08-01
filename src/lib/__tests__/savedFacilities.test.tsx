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
