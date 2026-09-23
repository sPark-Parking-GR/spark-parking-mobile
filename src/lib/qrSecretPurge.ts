import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

const PURGE_FLAG_KEY = 'spark-qr-secrets-purged'
const TRIPS_CACHE_PREFIX = 'spark-trips:'
const LEGACY_SECRET_PREFIX = 'spark-qr-'

// Reproduces the key an earlier build derived, character filter included: a secret written
// under the sanitised id cannot be deleted with the raw one.
function legacySecretKey(bookingId: string): string {
  return `${LEGACY_SECRET_PREFIX}${bookingId.replace(/[^A-Za-z0-9._-]/g, '')}`
}

function bookingIdsIn(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((entry) =>
        typeof entry === 'object' && entry !== null
          ? (entry as { bookingId?: unknown }).bookingId
          : null,
      )
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

/**
 * Until this build the API handed the phone each booking's qrSecret and it was kept in the
 * keystore. The server now mints every payload itself, so those secrets have no remaining
 * use here while still minting valid entry codes — an update that left them in the
 * keystore would preserve exactly the exposure moving to server-minted codes removes.
 *
 * SecureStore cannot enumerate its own keys, so the booking ids are recovered from the
 * trips caches, which is where every booking that could have had a secret written for it
 * is recorded. Run before anything can rewrite those caches.
 */
export async function purgeLegacyQrSecrets(): Promise<void> {
  const alreadyPurged = await AsyncStorage.getItem(PURGE_FLAG_KEY).catch(() => null)
  if (alreadyPurged) return

  const keys = await AsyncStorage.getAllKeys().catch((): readonly string[] => [])
  const tripCaches = keys.filter((key) => key.startsWith(TRIPS_CACHE_PREFIX))
  const entries = await AsyncStorage.multiGet(tripCaches).catch(() => [])

  const bookingIds = new Set(entries.flatMap(([, raw]) => (raw ? bookingIdsIn(raw) : [])))
  await Promise.all(
    [...bookingIds].map((bookingId) =>
      SecureStore.deleteItemAsync(legacySecretKey(bookingId)).catch(() => undefined),
    ),
  )

  await AsyncStorage.setItem(PURGE_FLAG_KEY, '1').catch(() => undefined)
}
