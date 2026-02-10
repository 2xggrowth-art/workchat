import { useState, useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgError, setOrgError] = useState('')
  const [orgLocked, setOrgLocked] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()
  const resolveTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Handle invite link: /join/WRK4829
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/\/join\/([A-Za-z0-9-]+)/)
    if (match) {
      const code = match[1]
      setOrgCode(code)
      setOrgLocked(true)
      setMode('register')
      resolveOrgCode(code)
      // Clean URL
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const resolveOrgCode = async (code: string) => {
    if (!code || code.length < 3) {
      setOrgName('')
      setOrgError('')
      return
    }
    try {
      const res = await api.get(`/api/auth/resolve-org/${code}`)
      setOrgName(res.data.data.name)
      setOrgError('')
    } catch {
      setOrgName('')
      setOrgError('Invalid organization code')
    }
  }

  const handleOrgCodeChange = (value: string) => {
    setOrgCode(value)
    setOrgName('')
    setOrgError('')
    if (resolveTimeout.current) clearTimeout(resolveTimeout.current)
    resolveTimeout.current = setTimeout(() => resolveOrgCode(value), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(phone, pin)
      } else {
        const msg = await register(phone, name, pin, orgCode)
        setSuccess(msg || 'Registration pending approval')
        setMode('login')
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Something went wrong'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full bg-white dark:bg-[#1C1C1E] flex flex-col items-center justify-center px-6 pt-safe">
      <div className="w-20 h-20 rounded-[20px] bg-teal flex items-center justify-center mb-4">
        <MessageSquare size={44} className="text-white" />
      </div>
      <h1 className="text-[28px] font-bold mb-1.5 dark:text-white">WorkChat</h1>
      <p className="text-[15px] text-gray-400 mb-10">A Work WhatsApp with enforced execution</p>

      <form onSubmit={handleSubmit} className="w-full max-w-[340px]">
        {mode === 'register' && (
          <>
            <div className="mb-3">
              <input
                type="text"
                value={orgCode}
                onChange={(e) => handleOrgCodeChange(e.target.value.toUpperCase())}
                placeholder="Organization Code (e.g. WRK-1234)"
                required
                disabled={orgLocked}
                className="w-full py-3.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-[17px] bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:border-teal placeholder-gray-400 disabled:opacity-60"
              />
              {orgName && (
                <p className="text-green-500 text-sm mt-1 px-1">{orgName}</p>
              )}
              {orgError && (
                <p className="text-red-500 text-sm mt-1 px-1">{orgError}</p>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full py-3.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-[17px] bg-gray-50 dark:bg-gray-800 dark:text-white mb-3 outline-none focus:border-teal placeholder-gray-400"
            />
          </>
        )}
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number (e.g. +1234567890)"
          required
          className="w-full py-3.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-[17px] bg-gray-50 dark:bg-gray-800 dark:text-white mb-3 outline-none focus:border-teal placeholder-gray-400"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={mode === 'register' ? 'Set PIN (4-6 digits)' : 'Enter PIN'}
          required
          className="w-full py-3.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-[17px] bg-gray-50 dark:bg-gray-800 dark:text-white mb-3 outline-none focus:border-teal placeholder-gray-400"
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-2">{success}</p>}

        <button
          type="submit"
          disabled={loading || (mode === 'register' && !!orgError)}
          className="w-full py-4 rounded-xl bg-wgreen text-white text-[17px] font-semibold mt-2 active:opacity-80 disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Register'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess('') }}
          className="w-full text-blue-500 text-[15px] mt-4 py-2"
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log In'}
        </button>
      </form>
    </div>
  )
}
