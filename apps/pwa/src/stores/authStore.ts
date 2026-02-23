import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'
import { api } from '../services/api'
import { initSocket, disconnectSocket } from '../services/socket'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  login: (phone: string, pin: string) => Promise<void>
  register: (phone: string, name: string, pin: string, orgCode: string) => Promise<string>
  logout: () => void
  refreshAccessToken: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,

      login: async (phone: string, pin: string) => {
        const response = await api.post('/api/auth/login', { phone, pin })
        const { user, accessToken, refreshToken } = response.data.data
        set({ user, token: accessToken, refreshToken })
        initSocket(accessToken)
      },

      register: async (phone: string, name: string, pin: string, orgCode: string) => {
        const response = await api.post('/api/auth/register', { phone, name, pin, orgCode })
        return response.data.data.message
      },

      logout: () => {
        const { token } = get()
        disconnectSocket()
        set({ user: null, token: null, refreshToken: null })
        if (token) {
          api.post('/api/auth/logout', {}, {
            headers: { Authorization: `Bearer ${token}` },
            _skipInterceptor: true,
          } as any).catch(() => {})
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')
        const response = await api.post('/api/auth/refresh', { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = response.data.data
        set({ token: accessToken, refreshToken: newRefreshToken })
      },

      fetchMe: async () => {
        const response = await api.get('/api/auth/me')
        set({ user: response.data.data })
      },
    }),
    {
      name: 'workchat-pwa-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
