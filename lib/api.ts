const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// Absolute session timeout constants
export const ABSOLUTE_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours

// Token & Session storage — localStorage persists across page refreshes
const TOKEN_KEY = 'hp_access_token'
const REFRESH_KEY = 'hp_refresh_token'
const SESSION_START_KEY = 'hp_session_start'
const SESSION_EXPIRES_AT_KEY = 'hp_session_expires_at'

export function getSessionExpiresAt(): number | null {
  if (typeof window === 'undefined') return null
  const expStr = localStorage.getItem(SESSION_EXPIRES_AT_KEY)
  if (!expStr) return null
  const exp = Number(expStr)
  return isNaN(exp) ? null : exp
}

export function isSessionExpired(): boolean {
  const expiresAt = getSessionExpiresAt()
  if (!expiresAt) return false
  return Date.now() >= expiresAt
}

export function getSessionRemainingMs(): number {
  const expiresAt = getSessionExpiresAt()
  if (!expiresAt) return 0
  return Math.max(0, expiresAt - Date.now())
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  if (isSessionExpired()) {
    clearStoredTokens()
    return null
  }
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || token === 'undefined' || token === 'null') return null
  return token
}

function setStoredTokens(
  access_token?: string,
  refresh_token?: string,
  session_expires_at?: number,
  session_start?: number
) {
  if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)

  // Track absolute session start and expiration (2 hours)
  const now = Date.now()
  const start = session_start || Number(localStorage.getItem(SESSION_START_KEY)) || now
  const expires = session_expires_at || (start + ABSOLUTE_SESSION_TIMEOUT_MS)

  localStorage.setItem(SESSION_START_KEY, String(start))
  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expires))
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(SESSION_START_KEY)
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  // If absolute 2-hour timeout has arrived, refuse to refresh
  if (isSessionExpired()) {
    clearStoredTokens()
    return null
  }

  const refresh_token = localStorage.getItem(REFRESH_KEY)
  if (!refresh_token || refresh_token === 'undefined' || refresh_token === 'null') return null
  const session_start = localStorage.getItem(SESSION_START_KEY)

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token, session_start }),
  })

  if (!res.ok) {
    clearStoredTokens()
    return null
  }

  const data = await res.json()
  const accessToken = data.access_token || data.session?.access_token
  const newRefreshToken = data.refresh_token || data.session?.refresh_token
  const newExpiresAt = data.session_expires_at ? Number(data.session_expires_at) : undefined

  setStoredTokens(accessToken, newRefreshToken, newExpiresAt)
  return accessToken ?? null
}

async function apiFetch(path: string, options: RequestInit = {}) {
  // Check absolute 2-hour session limit before making request
  if (isSessionExpired()) {
    clearStoredTokens()
    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=timeout'
    }
    throw new Error('Your session timed out after 2 hours. Please log in again.')
  }

  let token = getStoredToken()

  if (!token) {
    throw new Error('No active session. Please log in again.')
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  // If token expired, check if session timeout or attempt refresh
  if (res.status === 401) {
    const errBody = await res.clone().json().catch(() => ({}))
    if (errBody?.code === 'SESSION_TIMEOUT' || isSessionExpired()) {
      clearStoredTokens()
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=timeout'
      }
      throw new Error('Your session timed out after 2 hours. Please log in again.')
    }

    token = await refreshAccessToken()
    if (!token) {
      if (typeof window !== 'undefined') {
        window.location.href = isSessionExpired() ? '/login?reason=timeout' : '/login'
      }
      throw new Error('Session expired. Please log in again.')
    }

    const retryRes = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!retryRes.ok) {
      const err = await retryRes.json().catch(() => ({}))
      if (err?.code === 'SESSION_TIMEOUT' || isSessionExpired()) {
        clearStoredTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=timeout'
        }
        throw new Error('Your session timed out after 2 hours. Please log in again.')
      }
      throw new Error(err.error || 'Request failed')
    }

    return retryRes.json()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Request failed')
  }

  return res.json()
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')

    // Store tokens and absolute 2-hour session expiration
    const accessToken = data.access_token || data.session?.access_token
    const refreshToken = data.refresh_token || data.session?.refresh_token
    const sessionExpiresAt = data.session_expires_at ? Number(data.session_expires_at) : undefined
    const sessionStart = data.session_start ? Number(data.session_start) : undefined
    setStoredTokens(accessToken, refreshToken, sessionExpiresAt, sessionStart)
    return data
  },

  getMe: () => apiFetch('/api/auth/me'),

  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors on logout
    } finally {
      clearStoredTokens()
    }
  },

  // Households
  getHouseholds: (page: number = 1, limit: number = 25) =>
    apiFetch(`/api/households?page=${page}&limit=${limit}`),

  patchHousehold: (id: string, body: object) =>
    apiFetch(`/api/households/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getAppointments: (id: string) =>
    apiFetch(`/api/households/${id}/appointments`),

  createAppointment: (id: string, scheduled_at: string) =>
    apiFetch(`/api/households/${id}/appointments`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_at }),
    }),

  deleteAppointment: (id: string, appointmentId: string) =>
    apiFetch(`/api/households/${id}/appointments/${appointmentId}`, {
      method: 'DELETE',
    }),

  // Admin
  getUsers: () => apiFetch('/api/admin/users'),

  createUser: (body: { email: string; password: string; role: string }) =>
    apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateUser: (id: string, body: object) =>
    apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateUserRole: (id: string, role: string) =>
    apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  updateUserStatus: (id: string, active: boolean) =>
    apiFetch(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  deleteUser: (id: string) =>
    apiFetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),

  // Panel Monitoring
  getPanelSummary: () => apiFetch('/api/panel/summary'),
  getPanelHeatmap: () => apiFetch('/api/panel/heatmap'),
  getPanelRegion: (regionCode: number) => apiFetch(`/api/panel/region/${regionCode}`),
  getPanelUnclassified: () => apiFetch('/api/panel/unclassified'),
  getPanelUpdates: () => apiFetch('/api/panel/updates'),
  getPanelDemographics: () => apiFetch('/api/panel/demographics'),
  getPanelViewership: (window: string = '24h', refresh: boolean = false) =>
    apiFetch(`/api/panel/viewership?window=${encodeURIComponent(window)}${refresh ? '&refresh=true' : ''}`),
}

export interface ViewershipMember {
  member_code?: string | null
  gender?: string | null
  age?: number | null
}

export interface HouseholdViewershipRow {
  hhid: string
  region: string
  current_status: string
  meter_id: string | null
  member_count: number
  members: ViewershipMember[]
  has_viewership: boolean
  image_viewership: {
    status: 'POSITIVE' | 'NEGATIVE' | 'NO_EVENTS'
    positive_count: number
    total_count: number
    latest_channel?: string | null
    latest_ts?: number | null
  }
  audio_viewership: {
    status: 'POSITIVE' | 'NEGATIVE' | 'NO_EVENTS'
    matched_count: number
    unmatched_count: number
    total_count: number
    latest_channel?: string | null
    latest_ts?: number | null
  }
  top_channels: Array<{ channel: string; count: number }>
  latest_event_ts: number | null
}

export interface ViewershipSummary {
  total_production_households: number
  positive_viewership_count: number
  negative_viewership_count: number
  positive_pct: number
  image_positive_count: number
  audio_positive_count: number
  dual_positive_count: number
  time_window: string
  from_timestamp: number
  to_timestamp: number
  regional_breakdown: Array<{
    region: string
    total_households: number
    positive_households: number
    negative_households: number
    positive_pct: number
  }>
  top_channels: Array<{
    channel: string
    count: number
    image_count: number
    audio_count: number
  }>
  households: HouseholdViewershipRow[]
}

