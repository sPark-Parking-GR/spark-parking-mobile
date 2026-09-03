import type { AuthResult, SignInCredentials } from '@spark/types'

import { request, requestNoContent } from './http'

export interface SignUpRequest {
  email: string
  password: string
  displayName?: string
}

export function signIn(credentials: SignInCredentials): Promise<AuthResult> {
  return request<AuthResult>('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

// No `role` in the payload: public sign-up is pinned to `user` server-side and the
// schema has no field to carry anything else.
export function signUp(data: SignUpRequest): Promise<AuthResult> {
  return request<AuthResult>('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function refresh(refreshToken: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

export function signOut(accessToken: string): Promise<void> {
  return requestNoContent('/auth/sign-out', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function forgotPassword(email: string): Promise<void> {
  return requestNoContent('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// The password is re-checked server-side: the bearer token proves a session, and erasing
// an account needs proof of the person holding the phone. A wrong one comes back 401, a
// booking still in progress 409.
export function deleteAccount(accessToken: string, password: string): Promise<void> {
  return requestNoContent('/auth/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
  })
}

export interface MobileProfileUpdate {
  pushToken?: string
  locale?: string
  appVersion?: string
}

// Self-scoped server-side (PATCH /auth/mobile-profile reads the caller's id off the bearer
// token, never the body) — an upsert, so the first call creates the row and later ones
// update it. The response body (the stored row) is never needed here.
export function updateMobileProfile(
  accessToken: string,
  update: MobileProfileUpdate,
): Promise<void> {
  return requestNoContent('/auth/mobile-profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(update),
  })
}
