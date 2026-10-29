const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// Token storage — localStorage persists across page refreshes
const TOKEN_KEY = 'hp_access_token'
const REFRESH_KEY = 'hp_refresh_token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || token === 'undefined' || token === 'null') return null
  return token
}

function setStoredTokens(access_token?: string, refresh_token?: string) {
  if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh_token = localStorage.getItem(REFRESH_KEY)
  if (!refresh_token || refresh_token === 'undefined' || refresh_token === 'null') return null

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })

  if (!res.ok) {
    clearStoredTokens()
    return null
  }

  const data = await res.json()
  const accessToken = data.access_token || data.session?.access_token
  const newRefreshToken = data.refresh_token || data.session?.refresh_token
  setStoredTokens(accessToken, newRefreshToken)
  return accessToken ?? null
}

async function apiFetch(path: string, options: RequestInit = {}) {
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

  // If token expired, refresh and retry once
  if (res.status === 401) {
    token = await refreshAccessToken()
    if (!token) {
      window.location.href = '/login'
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

    // Store tokens (supports both root and session level tokens)
    const accessToken = data.access_token || data.session?.access_token
    const refreshToken = data.refresh_token || data.session?.refresh_token
    setStoredTokens(accessToken, refreshToken)
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

  deleteUser: (id: string) =>
    apiFetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),

  // Panel Monitoring
  getPanelSummary: () => apiFetch('/api/panel/summary'),
  getPanelHeatmap: () => apiFetch('/api/panel/heatmap'),
  getPanelRegion: (regionCode: number) => apiFetch(`/api/panel/region/${regionCode}`),
  getPanelUnclassified: () => apiFetch('/api/panel/unclassified'),
}
