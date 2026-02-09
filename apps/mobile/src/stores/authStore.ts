import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../services/api'
import { socketService } from '../services/socket'

interface User {
  id: string
  phone: string
  name: string
  avatarUrl: string | null
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
  isApproved: boolean
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  login: (phone: string, pin: string) => Promise<void>
  register: (phone: string, pin: string, name: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const [token, refreshToken, userJson] = await AsyncStorage.multiGet([
        'workchat-token',
        'workchat-refresh-token',
        'workchat-user',
      ])

      const storedToken = token[1]
      const storedRefreshToken = refreshToken[1]
      const storedUser = userJson[1] ? JSON.parse(userJson[1]) : null

      set({
        token: storedToken,
        refreshToken: storedRefreshToken,
        user: storedUser,
        isInitialized: true,
      })

      if (storedToken) {
        try {
          const response = await api.get('/api/auth/me')
          set({ user: response.data.data })
          await AsyncStorage.setItem('workchat-user', JSON.stringify(response.data.data))
          socketService.connect()
        } catch (error: any) {
          if (error.response?.status === 401 && storedRefreshToken) {
            try {
              const refreshResponse = await api.post('/api/auth/refresh', {
                refreshToken: storedRefreshToken,
              })
              const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data

              await AsyncStorage.setItem('workchat-token', accessToken)
              await AsyncStorage.setItem('workchat-refresh-token', newRefreshToken)

              set({
                token: accessToken,
                refreshToken: newRefreshToken,
              })

              const userResponse = await api.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
              })
              set({ user: userResponse.data.data })
              await AsyncStorage.setItem('workchat-user', JSON.stringify(userResponse.data.data))
              socketService.connect()
            } catch (refreshError) {
              console.log('Token refresh failed, clearing auth state')
              await AsyncStorage.multiRemove(['workchat-token', 'workchat-refresh-token', 'workchat-user'])
              set({ token: null, refreshToken: null, user: null })
            }
          } else {
            await AsyncStorage.multiRemove(['workchat-token', 'workchat-refresh-token', 'workchat-user'])
            set({ token: null, refreshToken: null, user: null })
          }
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error)
      set({ isInitialized: true })
    }
  },

  login: async (phone: string, pin: string) => {
    set({ isLoading: true })
    try {
      const response = await api.post('/api/auth/login', { phone, pin })
      const { user, accessToken, refreshToken } = response.data.data

      await AsyncStorage.setItem('workchat-token', accessToken)
      await AsyncStorage.setItem('workchat-refresh-token', refreshToken)
      await AsyncStorage.setItem('workchat-user', JSON.stringify(user))

      set({
        user,
        token: accessToken,
        refreshToken,
        isLoading: false,
      })

      socketService.connect()
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (phone: string, pin: string, name: string) => {
    set({ isLoading: true })
    try {
      const response = await api.post('/api/auth/register', { phone, pin, name })
      set({ isLoading: false })
      return response.data.data
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: async () => {
    socketService.disconnect()

    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Ignore errors
    }

    await AsyncStorage.multiRemove(['workchat-token', 'workchat-refresh-token', 'workchat-user'])

    set({
      user: null,
      token: null,
      refreshToken: null,
    })
  },

  setUser: (user: User) => {
    set({ user })
    AsyncStorage.setItem('workchat-user', JSON.stringify(user))
  },
}))
