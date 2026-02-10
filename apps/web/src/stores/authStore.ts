import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, UserRole } from '@workchat/shared'
import { api } from '../services/api'
import { initSocket, disconnectSocket } from '../services/socket'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null

  // Actions
  login: (phone: string, pin: string) => Promise<void>
  register: (phone: string, pin: string, name: string, orgCode: string) => Promise<{ message: string }>
  logout: () => void
  refreshAccessToken: () => Promise<void>
  setUser: (user: User) => void
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

        set({
          user,
          token: accessToken,
          refreshToken,
        })

        initSocket(accessToken)
      },

      register: async (phone: string, pin: string, name: string, orgCode: string) => {
        const response = await api.post('/api/auth/register', { phone, pin, name, orgCode })
        return response.data.data
      },

      logout: () => {
        api.post('/api/auth/logout').catch(() => {})
        disconnectSocket()
        set({
          user: null,
          token: null,
          refreshToken: null,
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const response = await api.post('/api/auth/refresh', { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = response.data.data

        set({
          token: accessToken,
          refreshToken: newRefreshToken,
        })
      },

      setUser: (user: User) => {
        set({ user })
      },
    }),
    {
      name: 'workchat-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

export const useIsAdmin = () => {
  const user = useAuthStore((state) => state.user)
  return user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN
}
