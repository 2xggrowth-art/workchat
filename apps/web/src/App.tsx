import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { initSocket } from './services/socket'

// Pages
import LoginPage from './pages/LoginPage'
import MainLayout from './pages/MainLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)

  // Initialize socket when app loads with existing token
  useEffect(() => {
    if (token) {
      initSocket(token)
    }
  }, [token])

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <div className="h-screen bg-[#f0f2f5] dark:bg-[#111B21]">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:code" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

export default App
