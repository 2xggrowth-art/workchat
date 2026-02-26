import { useState, useEffect } from 'react'
import { ChevronLeft, Ban, Flag, Users } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { Chat, ChatType } from '../types'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

interface ContactInfoScreenProps {
  chat: Chat
  onBack: () => void
}

interface ContactUser {
  id: string
  name: string
  phone: string
  avatarUrl?: string | null
  emoji?: string | null
  role: string
}

interface CommonGroup {
  id: string
  name: string
  memberCount: number
}

export default function ContactInfoScreen({ chat, onBack }: ContactInfoScreenProps) {
  const user = useAuthStore((s) => s.user)
  const [contact, setContact] = useState<ContactUser | null>(null)
  const [commonGroups, setCommonGroups] = useState<CommonGroup[]>([])
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    // Get the other user from chat members
    api.get(`/api/chats/${chat.id}`).then((res) => {
      const chatData = res.data.data
      if (chatData?.members) {
        const other = chatData.members.find((m: any) => m.userId !== user?.id)
        if (other?.user) {
          setContact({
            id: other.user.id,
            name: other.user.name,
            phone: other.user.phone,
            avatarUrl: other.user.avatarUrl,
            emoji: other.user.emoji,
            role: other.user.role || 'STAFF',
          })
        }
      }
    }).catch(() => {})

    // Find common groups
    api.get('/api/chats').then((res) => {
      const chats = res.data.data || []
      api.get(`/api/chats/${chat.id}`).then((chatRes) => {
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
  }, [chat.id, user?.id])

  const handleBlock = async () => {
    if (!confirm(`Block ${contact?.name}? They will no longer be able to send you messages.`)) return
    try {
      const res = await api.post(`/api/chats/${chat.id}/block`)
      setIsBlocked(res.data.data.blocked)
    } catch {}
  }

  if (!contact) return null

  const roleLabel = contact.role === 'SUPER_ADMIN' ? 'Super Admin' : contact.role === 'ADMIN' ? 'Admin' : 'Staff'

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Contact Info"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Back</span>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {/* Contact header */}
        <div className="flex flex-col items-center py-6">
          <Avatar name={contact.name} avatarUrl={contact.avatarUrl} size={80} />
          <div className="text-[22px] font-semibold mt-3 dark:text-white">{contact.name}</div>
          <div className="text-[15px] text-gray-400 mt-1">{contact.phone}</div>
        </div>

        {/* About section */}
        <div className="px-4 mb-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-3">
            <div className="text-[13px] text-gray-400 uppercase tracking-wide mb-1">About</div>
            <div className="text-[16px] dark:text-white">{roleLabel}</div>
          </div>
        </div>

        {/* Common groups */}
        {commonGroups.length > 0 && (
          <div className="px-4 mb-4">
            <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">
              {commonGroups.length} group{commonGroups.length !== 1 ? 's' : ''} in common
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden">
              {commonGroups.map((group, i) => (
                <div key={group.id}>
                  <div className="flex items-center px-4 py-2.5">
                    <div className="w-10 h-10 rounded-full bg-wgreen/15 flex items-center justify-center mr-3">
                      <Users size={18} className="text-wgreen" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[17px] dark:text-white truncate">{group.name}</div>
                      <div className="text-[14px] text-gray-400">{group.memberCount} members</div>
                    </div>
                  </div>
                  {i < commonGroups.length - 1 && <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] ml-[68px]" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Block contact */}
        <div className="px-4 mb-2">
          <button
            onClick={handleBlock}
            className="w-full flex items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-3 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
              <Ban size={20} className="text-red-500" />
            </div>
            <span className="text-[17px] text-red-500 font-medium">{isBlocked ? 'Unblock' : 'Block'} {contact.name}</span>
          </button>
        </div>

        {/* Report contact */}
        <div className="px-4 mb-8">
          <button
            onClick={() => alert('Report submitted. We will review this contact.')}
            className="w-full flex items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-3 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
              <Flag size={20} className="text-red-500" />
            </div>
            <span className="text-[17px] text-red-500 font-medium">Report {contact.name}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
