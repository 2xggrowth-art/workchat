import { useState, useEffect } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import SearchBar from '../components/SearchBar'
import Avatar from '../components/Avatar'
import { api } from '../services/api'
import { User, Chat } from '../types'
import { useChatStore } from '../stores/chatStore'
import { useAuthStore } from '../stores/authStore'

interface NewGroupScreenProps {
  onBack: () => void
  onOpenChat: (chat: Chat) => void
}

export default function NewGroupScreen({ onBack, onOpenChat }: NewGroupScreenProps) {
  const [step, setStep] = useState<'members' | 'name'>('members')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const { createGroupChat } = useChatStore()
  const currentUser = useAuthStore((s) => s.user)

  useEffect(() => {
    api.get('/api/users').then((res) => {
      setUsers((res.data.data || []).filter((u: User) => u.id !== currentUser?.id))
    }).catch(() => {})
  }, [])

  const filtered = search ? users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())) : users

  const toggleUser = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length === 0) return
    setLoading(true)
    try {
      const chat = await createGroupChat(groupName.trim(), selected)
      onOpenChat(chat)
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }

  if (step === 'name') {
    return (
      <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
        <IOSNav
          title="New Group"
          left={
            <button onClick={() => setStep('members')} className="text-blue-500 flex items-center gap-0.5 p-2">
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
          }
          right={
            <button onClick={handleCreate} disabled={loading} className="text-blue-500 font-semibold text-[17px] p-2 disabled:opacity-50">
              Create
            </button>
          }
        />
        <div className="px-4 py-6">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden">
            <div className="flex items-center px-4 py-3">
              <span className="text-[17px] min-w-[90px] dark:text-white">Name</span>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                autoFocus
                className="flex-1 text-right text-[17px] bg-transparent border-none outline-none dark:text-white placeholder-gray-300"
              />
            </div>
          </div>
          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-2 mt-4">
            {selected.length} member{selected.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            {selected.map((id) => {
              const u = users.find((x) => x.id === id)
              return u ? (
                <div key={id} className="flex items-center gap-1.5 bg-white dark:bg-[#1C1C1E] rounded-full px-3 py-1.5">
                  <Avatar name={u.name} size={24} />
                  <span className="text-[14px] dark:text-white">{u.name}</span>
                </div>
              ) : null
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Add Members"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        }
        right={
          selected.length > 0 ? (
            <button onClick={() => setStep('name')} className="text-blue-500 font-semibold text-[17px] p-2">
              Next
            </button>
          ) : undefined
        }
      >
        <SearchBar value={search} onChange={setSearch} placeholder="Search contacts" />
      </IOSNav>

      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        <div className="bg-white dark:bg-[#1C1C1E]">
          {filtered.map((user, i) => (
            <div key={user.id}>
              <button
                onClick={() => toggleUser(user.id)}
                className="flex items-center w-full px-4 py-2.5 active:bg-gray-100 dark:active:bg-gray-800"
              >
                <Avatar name={user.name} avatarUrl={user.avatarUrl} size={40} className="mr-3" />
                <div className="text-left flex-1">
                  <div className="text-[17px] dark:text-white">{user.name}</div>
                  <div className="text-[14px] text-gray-400">{user.phone}</div>
                </div>
                {selected.includes(user.id) && (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
              {i < filtered.length - 1 && <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] ml-[68px]" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
