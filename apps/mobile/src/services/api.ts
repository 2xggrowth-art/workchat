import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000'

if (__DEV__) console.log('[API] Base URL:', API_URL)

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('workchat-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle token refresh and log errors in dev
api.interceptors.response.use(
  (response) => {
    if (__DEV__) console.log('[API] Response:', response.status, response.config.url)
    return response
  },
  async (error) => {
    if (__DEV__) {
      console.log('[API] Error:', error.message, error.config?.url)
      console.log('[API] Error details:', error.response?.status, error.response?.data)
    }
    const originalRequest = error.config

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = await AsyncStorage.getItem('workchat-refresh-token')
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data.data
          await AsyncStorage.setItem('workchat-token', accessToken)
          await AsyncStorage.setItem('workchat-refresh-token', newRefreshToken)

          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        await AsyncStorage.multiRemove(['workchat-token', 'workchat-refresh-token', 'workchat-user'])
        // Navigation will be handled by auth store
      }
    }

    return Promise.reject(error)
  }
)
