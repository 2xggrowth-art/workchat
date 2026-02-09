import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

type Mode = 'login' | 'register' | 'pending'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, register } = useAuthStore()

  const [mode, setMode] = useState<Mode>('login')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    let formattedPhone = phone.trim().replace(/\s+/g, '')
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone
    }

    try {
      await login(formattedPhone, pin)
      navigate('/')
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Login failed'
      if (msg.includes('pending approval')) {
        setMode('pending')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    let formattedPhone = phone.trim().replace(/\s+/g, '')
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone
    }

    try {
      await register(formattedPhone, pin, name.trim())
      setMode('pending')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)' }}>
        <div className="bg-white rounded-xl shadow-2xl p-12 w-[400px] text-center">
          <div className="w-20 h-20 bg-[#FFC107] rounded-full mx-auto flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#075E54] mb-2">Registration Submitted</h1>
          <p className="text-gray-500 mb-8 text-sm">Your account is pending approval from an admin. You will be able to log in once approved.</p>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className="w-full py-3.5 bg-[#25D366] text-white rounded-lg font-semibold text-base hover:bg-[#1da851] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)' }}>
      <div className="bg-white rounded-xl shadow-2xl p-12 w-[400px] text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-[#075E54] rounded-full mx-auto flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 12H7v-2h10v2zm0-3H7V9h10v2zm0-3H7V6h10v2z"/>
          </svg>
        </div>
        <h1 className="text-[28px] font-bold text-[#075E54] mb-1">WorkChat</h1>
        <p className="text-gray-500 mb-8 text-sm">A Work WhatsApp with enforced execution</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full px-4 py-3.5 border-[1.5px] border-gray-200 rounded-lg text-[15px] outline-none focus:border-[#128C7E] transition-colors bg-white text-gray-900"
              required
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter PIN (4-6 digits)"
              className="w-full px-4 py-3.5 border-[1.5px] border-gray-200 rounded-lg text-[15px] outline-none focus:border-[#128C7E] transition-colors bg-white text-gray-900"
              required
            />
            <button
              type="submit"
              disabled={loading || !phone || !pin}
              className="w-full py-3.5 bg-[#25D366] text-white rounded-lg font-semibold text-base hover:bg-[#1da851] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className="text-[#128C7E] font-medium hover:underline"
              >
                Register
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3.5 border-[1.5px] border-gray-200 rounded-lg text-[15px] outline-none focus:border-[#128C7E] transition-colors bg-white text-gray-900"
              required
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full px-4 py-3.5 border-[1.5px] border-gray-200 rounded-lg text-[15px] outline-none focus:border-[#128C7E] transition-colors bg-white text-gray-900"
              required
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Set PIN (4-6 digits)"
              minLength={4}
              className="w-full px-4 py-3.5 border-[1.5px] border-gray-200 rounded-lg text-[15px] outline-none focus:border-[#128C7E] transition-colors bg-white text-gray-900"
              required
            />
            <button
              type="submit"
              disabled={loading || !phone || !pin || !name.trim()}
              className="w-full py-3.5 bg-[#25D366] text-white rounded-lg font-semibold text-base hover:bg-[#1da851] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="text-[#128C7E] font-medium hover:underline"
              >
                Log In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
