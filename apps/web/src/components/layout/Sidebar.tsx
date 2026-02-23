import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore, useIsAdmin } from '../../stores/authStore'
import { api } from '../../services/api'
import { getSocket } from '../../services/socket'
import { formatMessageTime } from '@workchat/shared'
import { ActiveView } from '../../pages/MainLayout'
import NewChatModal from '../contacts/NewChatModal'
import ProfileModal from '../profile/ProfileModal'

type FilterType = 'all' | 'unread' | 'groups'

interface SidebarProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navigate = useNavigate()
  const { chatId } = useParams<{ chatId: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const isAdmin = useIsAdmin()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [showMenu, setShowMenu] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const { data: chatsData, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const response = await api.get('/api/chats')
      return response.data.data
    },
  })

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    }

    socket.on('new_message', refresh)
    socket.on('chat_created', refresh)
    socket.on('chat_updated', refresh)

    return () => {
      socket.off('new_message', refresh)
      socket.off('chat_created', refresh)
      socket.off('chat_updated', refresh)
    }
  }, [queryClient])

  const chats = chatsData || []

  const filteredChats = chats.filter((chat: any) => {
    if (searchQuery && !chat.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (activeFilter === 'groups' && chat.type !== 'GROUP') return false
    if (activeFilter === 'unread' && (!chat.unreadCount || chat.unreadCount === 0)) return false
    return true
  })

  const handleDarkModeToggle = () => {
    document.documentElement.classList.toggle('dark')
    setShowMenu(false)
  }

  return (
    <div className="w-[30%] min-w-[340px] max-w-[440px] flex flex-col border-r border-[#e9edef] dark:border-[#222D34] bg-white dark:bg-[#111B21]">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-4 flex items-center justify-between min-h-[60px]">
        <h2 className="text-white text-xl font-semibold">WorkChat</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-white/10 hover:text-white transition-colors"
            title="New chat"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-white/10 hover:text-white transition-colors"
              title="Menu"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/>
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-[220px] bg-white dark:bg-[#233138] rounded-lg shadow-lg py-1.5 z-20">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => { setShowMenu(false); onViewChange('admin-summary'); }}
                        className="w-full px-5 py-3 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                      >
                        <svg className="w-[18px] h-[18px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                        </svg>
                        Admin Summary
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onViewChange('user-approval'); }}
                        className="w-full px-5 py-3 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                      >
                        <svg className="w-[18px] h-[18px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        Pending Users
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onViewChange('org-settings'); }}
                        className="w-full px-5 py-3 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                      >
                        <svg className="w-[18px] h-[18px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                        </svg>
                        Organization
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setShowMenu(false); setShowProfileModal(true); }}
                    className="w-full px-5 py-3 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                  >
                    <svg className="w-[18px] h-[18px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    Profile
                  </button>
                  <button
                    onClick={handleDarkModeToggle}
                    className="w-full px-5 py-3 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                  >
                    <svg className="w-[18px] h-[18px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
                    </svg>
                    <span className="dark:hidden">Dark Mode</span>
                    <span className="hidden dark:inline">Light Mode</span>
                  </button>
                  <div className="border-t border-gray-200 dark:border-[#3B4A54] my-1" />
                  <button
                    onClick={() => { setShowMenu(false); logout(); navigate('/login'); }}
                    className="w-full px-5 py-3 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                  >
                    <svg className="w-[18px] h-[18px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-white dark:bg-[#111B21] border-b border-[#e9edef] dark:border-[#222D34]">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
          </svg>
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 pl-10 pr-3 rounded-lg bg-[#f0f2f5] dark:bg-[#202C33] text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] outline-none text-sm"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-3 py-2 border-b border-[#e9edef] dark:border-[#222D34]">
        {(['all', 'unread', 'groups'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              activeFilter === f
                ? 'bg-[#075E54] text-white'
                : 'bg-[#f0f2f5] dark:bg-[#202C33] text-gray-500 dark:text-[#E9EDEF] hover:bg-[#e9edef] dark:hover:bg-[#2A3942]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Groups'}
          </button>
        ))}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-[#8696A0] px-8 text-center">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
            </svg>
            <p className="text-sm">{searchQuery ? 'No chats found' : 'No chats yet'}</p>
            {!searchQuery && (
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm hover:bg-[#1da851] transition-colors"
              >
                Start a new chat
              </button>
            )}
          </div>
        ) : (
          filteredChats.map((chat: any) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              currentUserId={user?.id}
              isActive={chat.id === chatId}
              onClick={() => { onViewChange('chats'); navigate(`/chat/${chat.id}`); }}
            />
          ))
        )}
      </div>

      <NewChatModal isOpen={showNewChatModal} onClose={() => setShowNewChatModal(false)} />
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  )
}

interface ChatListItemProps {
  chat: any
  currentUserId: string | undefined
  isActive: boolean
  onClick: () => void
}

function ChatListItem({ chat, currentUserId, isActive, onClick }: ChatListItemProps) {
  const getDisplayInfo = () => {
    if (chat.type === 'DIRECT' && chat.members && currentUserId) {
      const other = chat.members.find((m: any) => m.userId !== currentUserId)
      if (other?.user) return { name: other.user.name, isGroup: false, emoji: other.user.avatarUrl || null }
    }
    return { name: chat.name, isGroup: chat.type === 'GROUP', emoji: null }
  }

  const info = getDisplayInfo()

  const getPreview = () => {
    if (!chat.lastMessage) return 'No messages yet'
    if (chat.lastMessage.deletedForEveryone) return 'This message was deleted'
    if (chat.lastMessage.type !== 'TEXT') {
      const labels: Record<string, string> = { AUDIO: 'Voice message', IMAGE: 'Photo', VIDEO: 'Video', FILE: 'Document' }
      return labels[chat.lastMessage.type] || chat.lastMessage.content
    }
    return chat.lastMessage.content
  }

  const avatarColors = ['#075E54', '#128C7E', '#25D366', '#6a1b9a', '#c62828', '#1565c0', '#2e7d32', '#e65100']
  const colorIndex = info.name ? info.name.charCodeAt(0) % avatarColors.length : 0

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#e9edef] dark:border-[#222D34] ${
        isActive ? 'bg-[#f5f6f6] dark:bg-[#2A3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202C33]'
      }`}
    >
      <div
        className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-lg"
        style={{ background: avatarColors[colorIndex] }}
      >
        {info.emoji ? (
          <span className="text-xl">{info.emoji}</span>
        ) : info.isGroup ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        ) : (
          info.name?.charAt(0).toUpperCase() || '?'
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-medium text-[16px] text-gray-900 dark:text-[#E9EDEF] truncate">{info.name}</span>
          {chat.lastMessage && (
            <span className={`text-xs whitespace-nowrap ${chat.unreadCount > 0 ? 'text-[#25D366] font-medium' : 'text-gray-500 dark:text-[#8696A0]'}`}>
              {formatMessageTime(chat.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-500 dark:text-[#8696A0] truncate">{getPreview()}</span>
          {chat.unreadCount > 0 && (
            <span className="bg-[#25D366] text-white text-[11px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 ml-2">
              {chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
