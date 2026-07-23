export interface IdentityStrategy {
  authHeaders(): Promise<Record<string, string>>
  bookingIdentity(): { guestEmail?: string; guestPhone?: string }
  canBook(): boolean
}

export class AnonymousIdentity implements IdentityStrategy {
  async authHeaders(): Promise<Record<string, string>> {
    return {}
  }

  bookingIdentity(): { guestEmail?: string; guestPhone?: string } {
    return {}
  }

  canBook(): boolean {
    return false
  }
}

export type IdentityConfig = { kind: 'anonymous' }

export function createIdentity(config: IdentityConfig): IdentityStrategy {
  switch (config.kind) {
    case 'anonymous':
      return new AnonymousIdentity()
  }
}

function getIdentityConfig(): IdentityConfig {
  return { kind: 'anonymous' }
}

export const identity = createIdentity(getIdentityConfig())
