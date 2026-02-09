import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(phone, pin)
      } else {
        const msg = await register(phone, name, pin)
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full py-3.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-[17px] bg-gray-50 dark:bg-gray-800 dark:text-white mb-3 outline-none focus:border-teal placeholder-gray-400"
          />
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
          disabled={loading}
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
