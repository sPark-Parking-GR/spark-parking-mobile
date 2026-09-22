const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://127.0.0.1:3001/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// `fetch` itself rejects (no `Response` at all) when the device cannot reach the API —
// offline, wrong host, refused connection, TLS failure. That rejection's message is
// whatever the native layer produced (e.g. a raw `java.net.ConnectException` string on
// Android), never localized and never meant for a user, so it is normalized to this
// dedicated type instead of being surfaced as-is.
export class NetworkError extends Error {
  constructor() {
    super('Network request failed')
    this.name = 'NetworkError'
  }
}

interface ErrorBody {
  message?: string | string[]
  errors?: { path: string; message: string }[]
}

// The API answers validation failures with a per-field `errors` array and everything
// else with a plain `message`; surface whichever is the more specific.
function errorMessage(body: ErrorBody, status: number): string {
  const field = body.errors?.[0]
  if (field) return field.message
  if (Array.isArray(body.message)) return body.message.join('. ')
  return body.message ?? `Request failed: ${status}`
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const isWrite = method !== 'GET' && method !== 'HEAD'
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }

  // React Native attaches an (empty) body to every POST, so a bodyless write
  // reaches Fastify with content-type undefined → "Unsupported Media Type".
  // Always send a valid JSON body for writes.
  const body = isWrite ? (init?.body ?? '{}') : init?.body
  if (body != null) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, method, headers, body })
  } catch {
    throw new NetworkError()
  }

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as ErrorBody
    throw new ApiError(errorMessage(errBody, response.status), response.status)
  }

  return response
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init)
  return response.json() as Promise<T>
}

export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await send(path, init)
}
