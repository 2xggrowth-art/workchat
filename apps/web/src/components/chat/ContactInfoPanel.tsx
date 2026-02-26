import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../services/api'
import { useQueryClient } from '@tanstack/react-query'

interface ContactInfoPanelProps {
  chatId: string
  onClose: () => void
}

interface ContactUser {
  id: string
  name: string
  phone: string
  avatarUrl?: string | null
  emoji?: string | null
  role: string
  createdAt: string
}

interface CommonGroup {
  id: string
  name: string
  memberCount: number
}

export default function ContactInfoPanel({ chatId, onClose }: ContactInfoPanelProps) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [contact, setContact] = useState<ContactUser | null>(null)
  const [commonGroups, setCommonGroups] = useState<CommonGroup[]>([])
  const [isBlocked, setIsBlocked] = useState(false)

  const avatarColors = ['#075E54', '#128C7E', '#25D366', '#6a1b9a', '#c62828', '#1565c0', '#2e7d32', '#e65100']
  const getColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length]

  useEffect(() => {
    // Fetch chat details to get the other user
    api.get(`/api/chats/${chatId}`).then((res) => {
      const chat = res.data.data
      if (chat?.members) {
        const other = chat.members.find((m: any) => m.userId !== user?.id)
        if (other?.user) {
          setContact({
            id: other.user.id,
            name: other.user.name,
            phone: other.user.phone,
            avatarUrl: other.user.avatarUrl,
            emoji: other.user.emoji,
            role: other.user.role || 'STAFF',
            createdAt: other.joinedAt,
          })
        }
      }
    }).catch(() => {})

    // Fetch all user's chats to find common groups
    api.get('/api/chats').then((res) => {
      const chats = res.data.data || []
      api.get(`/api/chats/${chatId}`).then((chatRes) => {
        const currentChat = chatRes.data.data
        const otherUser = currentChat?.members?.find((m: any) => m.userId !== user?.id)
        if (!otherUser) return

        const groups = chats.filter((c: any) =>
          c.type === 'GROUP' &&
          c.members?.some((m: any) => m.userId === otherUser.userId)
        ).map((c: any) => ({
          id: c.id,
          name: c.name,
          memberCount: c.members?.length || 0,
        }))
        setCommonGroups(groups)
      })
    }).catch(() => {})
  }, [chatId, user?.id])

  const handleBlock = async () => {
    if (!confirm(`Block ${contact?.name}? They will no longer be able to send you messages.`)) return
    try {
      const res = await api.post(`/api/chats/${chatId}/block`)
      setIsBlocked(res.data.data.blocked)
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    } catch {}
  }

  if (!contact) return null

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[340px] bg-[#f0f2f5] dark:bg-[#111b21] border-l border-[#e9edef] dark:border-[#313d45] z-20 flex flex-col shadow-lg">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-white hover:bg-white/10 p-1.5 rounded-full">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <span className="text-white font-medium text-[16px]">Contact Info</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Contact header */}
        <div className="bg-white dark:bg-[#1f2c33] px-6 py-5 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-semibold" style={{ background: getColor(contact.name) }}>
            {contact.emoji || contact.avatarUrl ? (
              <span className="text-3xl">{contact.emoji || contact.avatarUrl}</span>
            ) : (
              contact.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="text-[20px] font-medium mt-3 dark:text-white">{contact.name}</div>
          <div className="text-[14px] text-[#667781] mt-0.5">{contact.phone}</div>
        </div>

        <div className="h-2" />

        {/* About section */}
        <div className="bg-white dark:bg-[#1f2c33] px-6 py-4">
          <div className="text-[13px] text-[#00a884] font-medium mb-2">About</div>
          <div className="text-[14px] text-[#667781]">
            {contact.role === 'SUPER_ADMIN' ? 'Super Admin' : contact.role === 'ADMIN' ? 'Admin' : 'Staff'}
          </div>
        </div>

        {/* Common groups */}
        {commonGroups.length > 0 && (
          <>
            <div className="h-2" />
            <div className="bg-white dark:bg-[#1f2c33]">
              <div className="px-6 py-3">
                <span className="text-[13px] text-[#00a884] font-medium">
                  {commonGroups.length} group{commonGroups.length !== 1 ? 's' : ''} in common
                </span>
              </div>
              {commonGroups.map((group) => (
                <div key={group.id} className="flex items-center px-6 py-2.5 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3" style={{ background: getColor(group.name) }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] dark:text-white truncate">{group.name}</div>
                    <div className="text-[13px] text-[#667781]">{group.memberCount} members</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="h-2" />

        {/* Block contact */}
        <div className="bg-white dark:bg-[#1f2c33]">
          <button onClick={handleBlock} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
            <span className="text-[15px] text-red-500">{isBlocked ? 'Unblock' : 'Block'} {contact.name}</span>
          </button>
        </div>

        {/* Report contact */}
        <div className="bg-white dark:bg-[#1f2c33] mt-px">
          <button
            onClick={() => alert('Report submitted. We will review this contact.')}
            className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]"
          >
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
            <span className="text-[15px] text-red-500">Report {contact.name}</span>
          </button>
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
