import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../services/api'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

const EMOJI_OPTIONS = [
  '\u{1F600}', '\u{1F468}\u{200D}\u{1F4BC}', '\u{1F469}\u{200D}\u{1F4BC}', '\u{1F477}\u{200D}\u{2642}\u{FE0F}', '\u{1F477}\u{200D}\u{2640}\u{FE0F}',
  '\u{1F9D1}\u{200D}\u{1F527}', '\u{1F468}\u{200D}\u{1F373}', '\u{1F469}\u{200D}\u{1F3EB}', '\u{1F9D1}\u{200D}\u{1F4BB}', '\u{1F3A8}',
  '\u{1F527}', '\u{26A1}', '\u{1F31F}', '\u{1F4AA}', '\u{1F3AF}',
  '\u{1F525}', '\u{1F4BC}', '\u{1F3D7}\u{FE0F}', '\u{1F4CA}', '\u{1F3AC}',
]

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [name, setName] = useState(user?.name || '')
  const [selectedEmoji, setSelectedEmoji] = useState(user?.avatarUrl || '')

  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; avatarUrl?: string }) => {
      const response = await api.patch(`/api/users/${user?.id}`, data)
      return response.data.data
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      onClose()
    },
  })

  const handleSave = () => {
    const updates: { name?: string; avatarUrl?: string } = {}
    if (name.trim() && name.trim() !== user?.name) updates.name = name.trim()
    if (selectedEmoji !== (user?.avatarUrl || '')) updates.avatarUrl = selectedEmoji
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  const avatarColors = ['#075E54', '#128C7E', '#25D366', '#6a1b9a', '#c62828', '#1565c0', '#2e7d32', '#e65100']
  const avatarColor = user?.name ? avatarColors[user.name.charCodeAt(0) % avatarColors.length] : '#6B7C85'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-[#111B21] rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#075E54] dark:bg-[#202C33] px-4 py-4 flex items-center gap-4">
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
            </svg>
          </button>
          <h2 className="text-white text-lg font-medium">Profile</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Current avatar display */}
          <div className="flex justify-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white font-semibold text-4xl"
              style={{ background: avatarColor }}
            >
              {selectedEmoji || user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] rounded-lg px-3 py-2.5 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] transition-colors"
              placeholder="Enter your name"
            />
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">
              Choose Avatar Emoji
            </label>
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(selectedEmoji === emoji ? '' : emoji)}
                  className={`w-10 h-10 text-2xl rounded-lg flex items-center justify-center transition-colors ${
                    selectedEmoji === emoji
                      ? 'bg-[#128C7E]/20 ring-2 ring-[#128C7E]'
                      : 'hover:bg-gray-100 dark:hover:bg-[#2A3942]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {selectedEmoji && (
              <button
                onClick={() => setSelectedEmoji('')}
                className="mt-2 text-xs text-[#128C7E] hover:underline"
              >
                Clear emoji (use initial instead)
              </button>
            )}
          </div>

          {/* Phone (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">
              Phone
            </label>
            <div className="text-sm text-gray-600 dark:text-[#8696A0]">{user?.phone}</div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">
              Role
            </label>
            <div className="text-sm text-gray-600 dark:text-[#8696A0]">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f0f2f5] dark:bg-[#202C33] border-t border-gray-200 dark:border-[#3B4A54]">
          {updateMutation.isError && (
            <p className="text-red-500 text-sm mb-3">Failed to update profile</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-[#2A3942] text-gray-700 dark:text-[#E9EDEF] rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#3B4A54] transition-colors border border-gray-200 dark:border-transparent"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-semibold hover:bg-[#1da851] transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
