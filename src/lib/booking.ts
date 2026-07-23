import { confirmBooking, createBooking } from './api'
import type { IdentityStrategy } from './identity'

export interface BookSpotInput {
  facilityId: string
  startsAt: string
  endsAt: string
  vehicleType: string
  vehiclePlate?: string
  idempotencyKey: string
}

export function newIdempotencyKey(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function localCode(): string {
  return `SPK-${Math.floor(1000 + Math.random() * 9000)}`
}

export async function bookSpot(
  input: BookSpotInput,
  identity: IdentityStrategy,
): Promise<{ code: string }> {
  if (!identity.canBook()) {
    return { code: localCode() }
  }

  if (!input.vehiclePlate) {
    throw new Error('vehiclePlate is required to create a booking')
  }

  const created = await createBooking({ ...input, vehiclePlate: input.vehiclePlate }, identity)
  const confirmed = await confirmBooking(created.bookingId)
  return { code: confirmed.accessCode }
}
