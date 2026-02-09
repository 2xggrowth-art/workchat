import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        await useAuthStore.getState().refreshAccessToken()
        const newToken = useAuthStore.getState().token
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
