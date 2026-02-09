import { useState, useEffect } from 'react'
import { ChevronLeft, Users } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import SearchBar from '../components/SearchBar'
import Avatar from '../components/Avatar'
import { api } from '../services/api'
import { User, Chat } from '../types'
import { useChatStore } from '../stores/chatStore'
import { useAuthStore } from '../stores/authStore'

interface NewChatScreenProps {
  onBack: () => void
  onOpenChat: (chat: Chat) => void
  onNewGroup: () => void
}

export default function NewChatScreen({ onBack, onOpenChat, onNewGroup }: NewChatScreenProps) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const { createDirectChat } = useChatStore()
  const currentUser = useAuthStore((s) => s.user)

  useEffect(() => {
    api.get('/api/users').then((res) => {
      setUsers((res.data.data || []).filter((u: User) => u.id !== currentUser?.id))
    }).catch(() => {})
  }, [])

  const filtered = search
    ? users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))
    : users

  const handleSelectUser = async (user: User) => {
    try {
      const chat = await createDirectChat(user.id)
      onOpenChat(chat)
    } catch {
      // error
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-20">
      <IOSNav
        title="New Chat"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        }
      >
        <SearchBar value={search} onChange={setSearch} placeholder="Search contacts" />
      </IOSNav>

      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {/* New Group option */}
        <button
          onClick={onNewGroup}
          className="flex items-center w-full px-4 py-3 bg-white dark:bg-[#1C1C1E] active:bg-gray-100 dark:active:bg-gray-800"
        >
          <div className="w-[40px] h-[40px] rounded-full bg-blue-500 flex items-center justify-center mr-3">
            <Users size={20} className="text-white" />
          </div>
          <span className="text-[17px] text-blue-500 font-medium">New Group</span>
        </button>
        <div className="h-px bg-black/[0.08] dark:bg-white/[0.1]" />

        {/* User list */}
        <div className="mt-4">
          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Contacts</div>
          <div className="bg-white dark:bg-[#1C1C1E]">
            {filtered.map((user, i) => (
              <div key={user.id}>
                <button
                  onClick={() => handleSelectUser(user)}
                  className="flex items-center w-full px-4 py-2.5 active:bg-gray-100 dark:active:bg-gray-800"
                >
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} size={40} className="mr-3" />
                  <div className="text-left">
                    <div className="text-[17px] dark:text-white">{user.name}</div>
                    <div className="text-[14px] text-gray-400">{user.phone}</div>
                  </div>
                </button>
                {i < filtered.length - 1 && <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] ml-[68px]" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
