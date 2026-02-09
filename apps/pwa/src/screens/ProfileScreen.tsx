import { useState } from 'react'
import { ChevronLeft, Camera } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

const PRESET_EMOJIS = [
  '\u{1F600}', '\u{1F468}\u{200D}\u{1F4BC}', '\u{1F469}\u{200D}\u{1F4BC}', '\u{1F477}\u{200D}\u{2642}\u{FE0F}', '\u{1F477}\u{200D}\u{2640}\u{FE0F}',
  '\u{1F9D1}\u{200D}\u{1F527}', '\u{1F468}\u{200D}\u{1F373}', '\u{1F469}\u{200D}\u{1F3EB}', '\u{1F9D1}\u{200D}\u{1F4BB}', '\u{1F3A8}',
  '\u{1F527}', '\u{26A1}', '\u{1F31F}', '\u{1F4AA}', '\u{1F3AF}',
  '\u{1F525}', '\u{1F4BC}', '\u{1F3D7}\u{FE0F}', '\u{1F4CA}', '\u{1F3AC}',
]

interface ProfileScreenProps {
  onBack: () => void
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { user, fetchMe } = useAuthStore()
  const [name, setName] = useState(user?.name || '')
  const [selectedEmoji, setSelectedEmoji] = useState(user?.emoji || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.patch(`/api/users/${user!.id}`, {
        name: name.trim(),
        emoji: selectedEmoji || null,
      })
      await fetchMe()
      onBack()
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Edit Profile"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Back</span>
          </button>
        }
        right={
          <button onClick={handleSave} disabled={saving} className="text-blue-500 font-semibold text-[17px] p-2 disabled:opacity-50">
            Save
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <Avatar name={user?.name || '?'} avatarUrl={user?.avatarUrl} emoji={selectedEmoji || null} size={100} />
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center border-2 border-white">
              <Camera size={14} className="text-white" />
            </div>
          </div>
        </div>

        <div className="px-4">
          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Profile Emoji</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4 p-3">
            <div className="grid grid-cols-10 gap-1">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(selectedEmoji === emoji ? '' : emoji)}
                  className={`w-full aspect-square rounded-lg flex items-center justify-center text-[24px] ${
                    selectedEmoji === emoji
                      ? 'bg-wgreen/20 ring-2 ring-wgreen'
                      : 'active:bg-gray-100 dark:active:bg-gray-700'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {selectedEmoji && (
              <button
                onClick={() => setSelectedEmoji('')}
                className="mt-2 text-[14px] text-red-500 w-full text-center"
              >
                Remove emoji
              </button>
            )}
          </div>

          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Name</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-[17px] bg-transparent border-none outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Phone</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3">
              <span className="text-[17px] text-gray-400">{user?.phone}</span>
            </div>
          </div>

          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Role</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3">
              <span className="text-[17px] text-gray-400 capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
