import { useState, useEffect } from 'react'
import { ChevronLeft, Shield, Crown } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { Chat, ChatMemberRole } from '../types'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

interface GroupInfoScreenProps {
  chat: Chat
  onBack: () => void
}

export default function GroupInfoScreen({ chat, onBack }: GroupInfoScreenProps) {
  const user = useAuthStore((s) => s.user)
  const [members, setMembers] = useState(chat.members || [])

  useEffect(() => {
    api.get(`/api/chats/${chat.id}`).then((res) => {
      if (res.data.data?.members) setMembers(res.data.data.members)
    }).catch(() => {})
  }, [chat.id])

  const roleIcon = (role: string) => {
    if (role === ChatMemberRole.OWNER) return <Crown size={14} className="text-yellow-500" />
    if (role === ChatMemberRole.ADMIN) return <Shield size={14} className="text-blue-500" />
    return null
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Group Info"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Back</span>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {/* Group header */}
        <div className="flex flex-col items-center py-6">
          <Avatar name={chat.name} size={80} />
          <div className="text-[22px] font-semibold mt-3 dark:text-white">{chat.name}</div>
          <div className="text-[15px] text-gray-400 mt-1">{members.length} members</div>
        </div>

        {/* Members */}
        <div className="px-4">
          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">
            Members ({members.length})
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden">
            {members.map((member, i) => (
              <div key={member.userId}>
                <div className="flex items-center px-4 py-2.5">
                  <Avatar name={member.user?.name || '?'} avatarUrl={member.user?.avatarUrl} size={40} className="mr-3" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[17px] dark:text-white">
                        {member.user?.name}{member.userId === user?.id ? ' (You)' : ''}
                      </span>
                      {roleIcon(member.role)}
                    </div>
                    <div className="text-[14px] text-gray-400">{member.user?.phone}</div>
                  </div>
                  <span className="text-[13px] text-gray-400 capitalize">{member.role.toLowerCase()}</span>
                </div>
                {i < members.length - 1 && <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] ml-[68px]" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
