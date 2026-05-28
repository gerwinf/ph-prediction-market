/**
 * Anonymous device identity. The cookie persists a stable id across
 * sessions so anon cards (no auth yet) can be linked to a user later
 * via the claim flow (Day 3B).
 *
 * Cookie name:  hula_device_id
 * Value:        UUID v4
 * Lifetime:     1 year
 * Attributes:   HttpOnly + Secure (prod) + SameSite=Lax
 *
 * Read/set from route handlers via cookies() from next/headers. We do
 * NOT set this in middleware because (a) middleware already crashed
 * prod once when env vars were missing and (b) cookie writes from
 * middleware require redirecting the response, which conflicts with
 * the auth session refresh pattern.
 */
import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'hula_device_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export async function getOrCreateDeviceId(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(COOKIE_NAME)?.value
  if (existing && isValidUuid(existing)) {
    return existing
  }

  const newId = crypto.randomUUID()
  jar.set(COOKIE_NAME, newId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return newId
}

export async function readDeviceId(): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(COOKIE_NAME)?.value
  return value && isValidUuid(value) ? value : null
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}
