import { useState, useEffect } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import SearchBar from '../components/SearchBar'
import Avatar from '../components/Avatar'
import { useChatStore } from '../stores/chatStore'
import { useAuthStore } from '../stores/authStore'
import { Chat, ChatType } from '../types'
import { format, parseISO, isToday, isYesterday } from 'date-fns'

interface ChatListScreenProps {
  onOpenChat: (chat: Chat) => void
  onNewChat: () => void
}

function formatChatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const date = parseISO(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MM/dd/yy')
  } catch {
    return ''
  }
}

function getChatDisplayName(chat: Chat, currentUserId: string): string {
  if (chat.type === ChatType.GROUP) return chat.name
  const other = chat.members?.find((m) => m.userId !== currentUserId)
  return other?.user?.name || chat.name || 'Chat'
}

function getLastMessagePreview(chat: Chat): string {
  if (!chat.lastMessage) return ''
  if (chat.lastMessage.deletedForEveryone) return 'This message was deleted'
  const sender = chat.lastMessage.sender?.name
  const prefix = chat.type === ChatType.GROUP && sender ? `${sender}: ` : ''
  if (chat.lastMessage.isTask) return `${prefix}[Task] ${chat.lastMessage.task?.title || ''}`
  return `${prefix}${chat.lastMessage.content || ''}`
}

export default function ChatListScreen({ onOpenChat, onNewChat }: ChatListScreenProps) {
  const [search, setSearch] = useState('')
  const { chats, fetchChats, loading } = useChatStore()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    fetchChats()
  }, [])

  const filtered = search
    ? chats.filter((c) =>
        getChatDisplayName(c, user?.id || '').toLowerCase().includes(search.toLowerCase())
      )
    : chats

  return (
    <div className="flex flex-col h-full">
      <IOSNav
        largeTitle="Chats"
        right={
          <button onClick={onNewChat} className="text-blue-500 p-2">
            <MessageSquarePlus size={22} />
          </button>
        }
      >
        <SearchBar value={search} onChange={setSearch} />
      </IOSNav>
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch bg-white dark:bg-[#1C1C1E]">
        {filtered.length === 0 && !loading && (
          <div className="text-center text-gray-400 text-[15px] py-10">
            {search ? 'No chats found' : 'No conversations yet'}
          </div>
        )}
        {filtered.map((chat, i) => (
          <div key={chat.id}>
            <div
              onClick={() => onOpenChat(chat)}
              className="flex items-center px-4 py-2.5 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
            >
              <Avatar name={getChatDisplayName(chat, user?.id || '')} avatarUrl={null} emoji={chat.type === ChatType.DIRECT ? chat.members?.find((m) => m.userId !== user?.id)?.user?.emoji : null} size={50} className="mr-3" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <div className="text-[17px] font-normal truncate dark:text-white">
                    {getChatDisplayName(chat, user?.id || '')}
                  </div>
                  <div className={`text-[15px] shrink-0 ml-2 ${chat.unreadCount > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                    {formatChatTime(chat.lastMessage?.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[15px] text-gray-400 truncate flex-1">
                    {getLastMessagePreview(chat)}
                  </span>
                  {chat.unreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-[13px] font-medium min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 shrink-0 ml-2">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {i < filtered.length - 1 && <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[82px]" />}
          </div>
        ))}
      </div>
    </div>
  )
}
