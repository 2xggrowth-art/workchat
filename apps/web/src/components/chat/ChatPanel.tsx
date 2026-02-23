import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore, useIsAdmin } from '../../stores/authStore'
import { api } from '../../services/api'
import { getSocket, joinChat, leaveChat, emitTyping } from '../../services/socket'
import { formatMessageTime, formatMessageDate, MessageType, TaskStatus, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@workchat/shared'
import ConvertToTaskModal from './ConvertToTaskModal'
import TaskDetailsPanel from '../task/TaskDetailsPanel'
import VoiceRecorder from './VoiceRecorder'
import VoiceNotePlayer from './VoiceNotePlayer'

export default function ChatPanel() {
  const { chatId } = useParams<{ chatId: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const isAdmin = useIsAdmin()
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedMessage, setSelectedMessage] = useState<any>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [editingMessage, setEditingMessage] = useState<{ id: string; chatId: string; content: string } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null)
  const [tasksOnlyView, setTasksOnlyView] = useState(false)
  const [taskFilter, setTaskFilter] = useState<string>('all')
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEmitRef = useRef<number>(0)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const { data: chat } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      const response = await api.get(`/api/chats/${chatId}`)
      return response.data.data
    },
  })

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      const response = await api.get(`/api/chats/${chatId}/messages`)
      return response.data
    },
  })

  const messages = messagesData?.data || []

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content?: string; type: MessageType; fileUrl?: string; replyToId?: string }) => {
      const response = await api.post(`/api/chats/${chatId}/messages`, data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      setMessageText('')
      setReplyingTo(null)
    },
  })

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File | Blob) => {
      const formData = new FormData()
      formData.append('file', file, file instanceof File ? file.name : 'voice-note.webm')
      const response = await api.post('/api/upload', formData)
      return response.data.data
    },
  })

  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const response = await api.patch(`/api/messages/${messageId}`, { content })
      return response.data.data
    },
    onSuccess: (updatedMsg) => {
      queryClient.setQueryData(['messages', chatId], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          data: oldData.data.map((m: any) => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m),
        }
      })
      setMessageText('')
      setEditingMessage(null)
    },
  })

  const deleteForMeMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.post(`/api/messages/${messageId}/delete`, { mode: 'for_me' })
      return messageId
    },
    onSuccess: (messageId) => {
      queryClient.setQueryData(['messages', chatId], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          data: oldData.data.filter((m: any) => m.id !== messageId),
        }
      })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const deleteForEveryoneMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.post(`/api/messages/${messageId}/delete`, { mode: 'for_everyone' })
      return messageId
    },
    onSuccess: (messageId) => {
      queryClient.setQueryData(['messages', chatId], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          data: oldData.data.map((m: any) =>
            m.id === messageId
              ? { ...m, content: null, fileUrl: null, deletedForEveryone: true, deletedAt: new Date().toISOString() }
              : m
          ),
        }
      })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
  })

  const pinMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await api.post(`/api/messages/${messageId}/pin`)
      return { messageId, pinned: response.data.data.pinned }
    },
    onSuccess: ({ messageId, pinned }) => {
      queryClient.setQueryData(['messages', chatId], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          data: oldData.data.map((m: any) => m.id === messageId ? { ...m, isPinned: pinned } : m),
        }
      })
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [chatId])

  // Mark chat as read when opened
  useEffect(() => {
    if (!chatId) return
    api.post(`/api/chats/${chatId}/mark-read`).catch(() => {})

    const socket = getSocket()
    if (!socket) return

    const handleMessagesRead = (data: { chatId: string }) => {
      if (data.chatId === chatId) {
        queryClient.invalidateQueries({ queryKey: ['chats'] })
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      }
    }
    socket.on('messages_read', handleMessagesRead)
    return () => { socket.off('messages_read', handleMessagesRead) }
  }, [chatId, queryClient])

  useEffect(() => {
    if (!chatId) return
    const socket = getSocket()
    if (!socket) return

    joinChat(chatId)

    const handleNewMessage = (data: { chatId: string; message: any }) => {
      if (data.chatId === chatId) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          if (!oldData) return oldData
          const exists = oldData.data?.some((m: any) => m.id === data.message.id)
          if (exists) return oldData
          return { ...oldData, data: [data.message, ...(oldData.data || [])] }
        })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
        // Mark as read since we're in the chat
        api.post(`/api/chats/${chatId}/mark-read`).catch(() => {})
      }
    }

    const handleTaskUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }

    // Typing indicator handler
    const handleTyping = (data: { chatId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.chatId !== chatId || data.userId === user?.id) return
      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.userName) ? prev : [...prev, data.userName]
        }
        return prev.filter((name) => name !== data.userName)
      })
    }

    const handleMessageEdited = (data: { chatId: string; message: any }) => {
      if (data.chatId === chatId) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            data: oldData.data.map((m: any) => m.id === data.message.id ? { ...m, ...data.message } : m),
          }
        })
      }
    }

    const handleMessageDeletedForEveryone = (data: { chatId: string; messageId: string }) => {
      if (data.chatId === chatId) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            data: oldData.data.map((m: any) =>
              m.id === data.messageId
                ? { ...m, content: null, fileUrl: null, deletedForEveryone: true, deletedAt: new Date().toISOString() }
                : m
            ),
          }
        })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      }
    }

    const handleMessagePinned = (data: { chatId: string; messageId: string }) => {
      if (data.chatId === chatId) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            data: oldData.data.map((m: any) => m.id === data.messageId ? { ...m, isPinned: true } : m),
          }
        })
      }
    }

    const handleMessageUnpinned = (data: { chatId: string; messageId: string }) => {
      if (data.chatId === chatId) {
        queryClient.setQueryData(['messages', chatId], (oldData: any) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            data: oldData.data.map((m: any) => m.id === data.messageId ? { ...m, isPinned: false } : m),
          }
        })
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('task_status_changed', handleTaskUpdate)
    socket.on('message_converted_to_task', handleTaskUpdate)
    socket.on('user_typing', handleTyping)
    socket.on('message_edited', handleMessageEdited)
    socket.on('message_deleted_for_everyone', handleMessageDeletedForEveryone)
    socket.on('message_pinned', handleMessagePinned)
    socket.on('message_unpinned', handleMessageUnpinned)

    return () => {
      leaveChat(chatId)
      socket.off('new_message', handleNewMessage)
      socket.off('task_status_changed', handleTaskUpdate)
      socket.off('message_converted_to_task', handleTaskUpdate)
      socket.off('user_typing', handleTyping)
      socket.off('message_edited', handleMessageEdited)
      socket.off('message_deleted_for_everyone', handleMessageDeletedForEveryone)
      socket.off('message_pinned', handleMessagePinned)
      socket.off('message_unpinned', handleMessageUnpinned)
      setTypingUsers([])
    }
  }, [chatId, queryClient, user?.id])

  // Clear typing users after timeout
  useEffect(() => {
    if (typingUsers.length === 0) return
    const timer = setTimeout(() => {
      setTypingUsers([])
    }, 3000)
    return () => clearTimeout(timer)
  }, [typingUsers])

  // Handle typing emit (debounced)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value)
    if (!chatId) return
    const now = Date.now()
    if (now - lastTypingEmitRef.current > 2000) {
      emitTyping(chatId)
      lastTypingEmitRef.current = now
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      // Could emit stop typing here if backend supports it
    }, 3000)
  }, [chatId])

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim() || !chatId) {
      setSearchResults([])
      return
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await api.get(`/api/chats/${chatId}/messages/search`, {
          params: { q: searchQuery },
        })
        setSearchResults(response.data.data || [])
      } catch {
        // Search endpoint may not exist yet, fall back to client-side
        const sorted = [...messages].reverse()
        const q = searchQuery.toLowerCase()
        setSearchResults(sorted.filter((m: any) => m.content?.toLowerCase().includes(q)))
      } finally {
        setIsSearching(false)
      }
    }, 500)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery, chatId, messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim()) return
    if (editingMessage) {
      editMessageMutation.mutate({ messageId: editingMessage.id, content: messageText.trim() })
    } else {
      sendMessageMutation.mutate({
        content: messageText.trim(),
        type: MessageType.TEXT,
        replyToId: replyingTo?.id,
      })
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setShowAttachMenu(false)
    try {
      const uploadResult = await uploadFileMutation.mutateAsync(file)
      await sendMessageMutation.mutateAsync({ type, fileUrl: uploadResult.url, replyToId: replyingTo?.id })
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleVoiceSend = async (blob: Blob) => {
    setIsRecordingVoice(false)
    setUploadingFile(true)
    try {
      const uploadResult = await uploadFileMutation.mutateAsync(blob)
      await sendMessageMutation.mutateAsync({ type: MessageType.AUDIO, fileUrl: uploadResult.url, replyToId: replyingTo?.id })
    } catch (error) {
      console.error('Voice upload failed:', error)
    } finally {
      setUploadingFile(false)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault()
    let x = e.clientX, y = e.clientY
    if (x + 200 > window.innerWidth) x -= 200
    if (y + 200 > window.innerHeight) y -= 200
    setContextMenu({ x, y, msgId })
  }

  // Scroll to a message and highlight it
  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMessageId(messageId)
      setTimeout(() => setHighlightedMessageId(null), 2000)
    }
  }, [])

  // Filter messages for tasks-only view
  const displayMessages = (() => {
    const sorted = [...messages].reverse()
    if (!tasksOnlyView) return sorted
    return sorted.filter((m: any) => {
      if (!m.isTask) return false
      if (taskFilter === 'all') return true
      if (taskFilter === 'pending') return m.task?.status === 'PENDING'
      if (taskFilter === 'overdue') return m.task?.dueDate && new Date(m.task.dueDate) < new Date() && m.task.status !== 'APPROVED' && m.task.status !== 'COMPLETED'
      if (taskFilter === 'completed') return m.task?.status === 'COMPLETED' || m.task?.status === 'APPROVED'
      return true
    })
  })()

  // Group by date
  const groupedMessages = displayMessages.reduce((groups: any[], message: any) => {
    const dateStr = formatMessageDate(message.createdAt)
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.date === dateStr) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ date: dateStr, messages: [message] })
    }
    return groups
  }, [])

  const chatHeaderName = (() => {
    if (chat?.type === 'DIRECT' && chat?.members) {
      const other = chat.members.find((m: any) => m.userId !== user?.id)
      return other?.user?.name || chat.name
    }
    return chat?.name || 'Loading...'
  })()

  const chatHeaderStatus = (() => {
    if (chat?.type === 'GROUP') {
      return chat.members?.map((m: any) => m.user?.name).filter(Boolean).join(', ') || ''
    }
    return 'online'
  })()

  const myMembership = chat?.members?.find((m: any) => m.userId === user?.id)
  const canPin = chat?.type === 'DIRECT' || myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN'

  const avatarColors = ['#075E54', '#128C7E', '#25D366', '#6a1b9a', '#c62828', '#1565c0', '#2e7d32', '#e65100']
  const avatarColor = chatHeaderName ? avatarColors[chatHeaderName.charCodeAt(0) % avatarColors.length] : '#6B7C85'

  // Get avatar display for chat header
  const getHeaderAvatar = () => {
    if (chat?.type === 'DIRECT' && chat?.members) {
      const other = chat.members.find((m: any) => m.userId !== user?.id)
      if (other?.user?.avatarUrl) return other.user.avatarUrl
    }
    return null
  }
  const headerEmoji = getHeaderAvatar()

  // Read receipt rendering
  const renderReadReceipt = (message: any) => {
    if (message.senderId !== user?.id) return null
    const readBy = message.readBy || []
    const isRead = readBy.length > 0
    const isDelivered = message.id // All sent messages are at least delivered if they have an id

    if (isRead) {
      // Blue double check
      return (
        <svg viewBox="0 0 16 11" className="w-4 h-4 text-[#53bdeb]" fill="currentColor">
          <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.146.47.47 0 00-.343.146l-.311.31a.445.445 0 00-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 00.514.211.692.692 0 00.543-.273l6.571-8.117a.45.45 0 00.102-.304.498.498 0 00-.178-.38l-.278-.223zm2.325 0a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-1.152-1.088-.406.469 1.718 1.718c.138.139.3.208.485.208a.69.69 0 00.57-.3l6.542-8.09a.45.45 0 00.102-.305.498.498 0 00-.178-.38l-.278-.222-.528-.722z"/>
        </svg>
      )
    }

    if (isDelivered) {
      // Grey double check (delivered)
      return (
        <svg viewBox="0 0 16 11" className="w-4 h-4 text-[#8696A0]" fill="currentColor">
          <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.146.47.47 0 00-.343.146l-.311.31a.445.445 0 00-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 00.514.211.692.692 0 00.543-.273l6.571-8.117a.45.45 0 00.102-.304.498.498 0 00-.178-.38l-.278-.223zm2.325 0a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-1.152-1.088-.406.469 1.718 1.718c.138.139.3.208.485.208a.69.69 0 00.57-.3l6.542-8.09a.45.45 0 00.102-.305.498.498 0 00-.178-.38l-.278-.222-.528-.722z"/>
        </svg>
      )
    }

    // Single check (sent)
    return (
      <svg viewBox="0 0 12 11" className="w-3 h-3 text-[#8696A0]" fill="currentColor">
        <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.146.47.47 0 00-.343.146l-.311.31a.445.445 0 00-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 00.514.211.692.692 0 00.543-.273l6.571-8.117a.45.45 0 00.102-.304.498.498 0 00-.178-.38l-.278-.223z"/>
      </svg>
    )
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Chat background pattern */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-4 flex items-center gap-3 min-h-[60px] z-10">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: avatarColor }}>
          {headerEmoji ? (
            <span className="text-xl">{headerEmoji}</span>
          ) : chat?.type === 'GROUP' ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          ) : chatHeaderName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-[16px] truncate">{chatHeaderName}</div>
          <div className="text-white/70 text-xs truncate">
            {typingUsers.length > 0
              ? `${typingUsers.join(', ')} typing...`
              : chatHeaderStatus}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setTasksOnlyView(!tasksOnlyView); setTaskFilter('all'); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${tasksOnlyView ? 'bg-white/15 text-[#25D366]' : 'text-[#aebac1] hover:bg-white/10 hover:text-white'}`}
            title="Tasks only view"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </button>
          <button
            onClick={() => {
              setShowSearch(!showSearch)
              if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100)
              else { setSearchQuery(''); setSearchResults([]) }
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showSearch ? 'bg-white/15 text-[#25D366]' : 'text-[#aebac1] hover:bg-white/10 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-white dark:bg-[#1f2c33] border-b border-gray-200 dark:border-[#222D34] z-10">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-8 py-2 bg-[#f0f2f5] dark:bg-[#202C33] text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg outline-none text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
                </svg>
              </button>
            )}
          </div>
          {/* Search results */}
          {searchQuery && (
            <div className="mt-2 max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="py-3 text-center text-sm text-gray-400">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="py-3 text-center text-sm text-gray-400">No results found</div>
              ) : (
                searchResults.map((msg: any) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setShowSearch(false)
                      setSearchQuery('')
                      setSearchResults([])
                      // If in tasks-only view, switch back
                      if (tasksOnlyView) setTasksOnlyView(false)
                      setTimeout(() => scrollToMessage(msg.id), 100)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#2A3942] rounded-lg transition-colors"
                  >
                    <div className="text-xs text-gray-400 dark:text-[#8696A0]">
                      {msg.sender?.name} - {formatMessageTime(msg.createdAt)}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-[#E9EDEF] truncate">
                      {msg.content || `[${msg.type}]`}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Tasks filter bar */}
      {tasksOnlyView && (
        <div className="flex gap-2 px-4 py-2 bg-white/90 dark:bg-[#1f2c33] border-b border-gray-200 dark:border-[#222D34] z-10">
          {['all', 'pending', 'overdue', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setTaskFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                taskFilter === f
                  ? 'bg-[#075E54] text-white'
                  : 'bg-[#f0f2f5] dark:bg-[#202C33] text-gray-500 dark:text-[#E9EDEF] hover:bg-[#e9edef] dark:hover:bg-[#2A3942]'
              }`}
            >
              {f === 'all' ? 'All Tasks' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Pinned messages banner */}
      {(() => {
        const pinnedMsgs = messages.filter((m: any) => m.isPinned)
        if (pinnedMsgs.length === 0) return null
        return (
          <div
            className="px-[60px] py-2 bg-white dark:bg-[#202C33] border-b border-gray-200 dark:border-[#222D34] flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2A3942] transition-colors z-10"
            onClick={() => scrollToMessage(pinnedMsgs[0].id)}
          >
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
              {pinnedMsgs.length === 1
                ? pinnedMsgs[0].content || 'Pinned message'
                : `${pinnedMsgs.length} pinned messages`}
            </span>
          </div>
        )
      })()}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-[60px] py-5 z-[1]" onClick={() => setContextMenu(null)}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white/90 dark:bg-[#1f2c33] rounded-lg px-4 py-2 shadow-sm">
              <p className="text-gray-500 dark:text-[#8696A0] text-sm">
                {tasksOnlyView ? 'No tasks in this chat' : 'No messages yet. Start the conversation!'}
              </p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group: any, gi: number) => (
            <div key={gi}>
              <div className="text-center my-3">
                <span className="bg-white/90 dark:bg-[#1f2c33] px-3.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-[#8696A0] shadow-sm">
                  {group.date}
                </span>
              </div>
              {group.messages.map((message: any) => {
                const isSent = message.senderId === user?.id
                const isTask = message.isTask && message.task
                const isHighlighted = highlightedMessageId === message.id

                if (isTask) {
                  const t = message.task
                  const status = t.status as TaskStatus
                  const borderColor = TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS[TaskStatus.PENDING]
                  const stepsTotal = t.steps?.length || 0
                  const stepsDone = t.steps?.filter((s: any) => s.completedAt).length || 0
                  const progressPct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0

                  return (
                    <div
                      key={message.id}
                      id={`msg-${message.id}`}
                      className={`flex mb-0.5 ${isSent ? 'justify-end' : 'justify-start'} transition-colors duration-500 ${
                        isHighlighted ? 'bg-yellow-200/40 dark:bg-yellow-500/10 rounded-lg' : ''
                      }`}
                    >
                      <div
                        className={`max-w-[380px] bg-white dark:bg-[#202C33] rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                          tasksOnlyView ? 'ring-1 ring-transparent hover:ring-[#128C7E]' : ''
                        }`}
                        style={{ borderLeft: `4px solid ${borderColor}` }}
                        onClick={() => {
                          if (tasksOnlyView) {
                            // Click-to-jump: exit tasks view and scroll to original message
                            setTasksOnlyView(false)
                            setTimeout(() => scrollToMessage(message.id), 100)
                          } else {
                            setTaskDetailId(t.id)
                          }
                        }}
                        onContextMenu={(e) => handleContextMenu(e, message.id)}
                      >
                        {!isSent && chat?.type === 'GROUP' && (
                          <div className="text-xs font-semibold text-[#075E54] mb-1">{message.sender?.name}</div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white tracking-wider"
                            style={{ background: borderColor, color: status === 'IN_PROGRESS' ? '#333' : 'white' }}
                          >
                            {status.replace('_', ' ')}
                          </span>
                          {tasksOnlyView && (
                            <span className="text-[10px] text-gray-400 dark:text-[#667781]">Click to jump</span>
                          )}
                          {!tasksOnlyView && (
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-[#E9EDEF] mb-1.5">{t.title}</div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-[#8696A0] mb-2">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            {t.owner?.name || 'Unassigned'}
                          </span>
                          {t.dueDate && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                              {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                            t.priority === 'URGENT' ? 'bg-red-700 text-white' :
                            t.priority === 'HIGH' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            t.priority === 'MEDIUM' ? 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {t.priority?.toLowerCase()}
                          </span>
                        </div>
                        {/* Tags display */}
                        {t.tags && t.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {t.tags.map((tag: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-[#075E54]/10 dark:bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] text-[10px] rounded-full font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {stepsTotal > 0 && (
                          <>
                            <div className="h-1 bg-gray-200 dark:bg-[#3B4A54] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: borderColor }} />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[11px] text-gray-400 dark:text-[#8696A0]">{stepsDone}/{stepsTotal} steps</span>
                              <span className="text-[11px] text-gray-400 dark:text-[#8696A0]">{formatMessageTime(message.createdAt)}</span>
                            </div>
                          </>
                        )}
                        {stepsTotal === 0 && (
                          <div className="text-right mt-1">
                            <span className="text-[11px] text-gray-400 dark:text-[#8696A0]">{formatMessageTime(message.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                // Regular message bubble
                return (
                  <div
                    key={message.id}
                    id={`msg-${message.id}`}
                    className={`flex mb-0.5 ${isSent ? 'justify-end' : 'justify-start'} transition-colors duration-500 ${
                      isHighlighted ? 'bg-yellow-200/40 dark:bg-yellow-500/10 rounded-lg' : ''
                    }`}
                  >
                    <div
                      className={`max-w-[65%] px-2 py-1.5 rounded-lg shadow-sm relative group ${
                        isSent
                          ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none'
                          : 'bg-white dark:bg-[#202C33] rounded-tl-none'
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, message.id)}
                    >
                      {!isSent && chat?.type === 'GROUP' && (
                        <div className="text-[12.5px] font-semibold text-[#075E54] mb-0.5">{message.sender?.name}</div>
                      )}

                      {message.replyTo && (
                        <div
                          className="mb-1 pb-1 border-l-2 border-[#128C7E] pl-2 bg-black/5 dark:bg-black/10 rounded cursor-pointer"
                          onClick={() => scrollToMessage(message.replyTo.id)}
                        >
                          <p className="text-xs text-[#128C7E] font-medium">{message.replyTo.sender?.name}</p>
                          <p className="text-xs text-gray-500 dark:text-[#8696A0] truncate">
                            {message.replyTo.deletedForEveryone ? 'This message was deleted' : (message.replyTo.content || `[${message.replyTo.type}]`)}
                          </p>
                        </div>
                      )}

                      {message.deletedForEveryone ? (
                        <div className="text-[14.2px] leading-[1.35] pr-[50px] text-gray-400 dark:text-[#8696A0] italic">This message was deleted</div>
                      ) : (
                        <>
                          {message.type === MessageType.IMAGE && message.fileUrl && (
                            <div className="w-[280px] h-[180px] rounded-md bg-gray-200 dark:bg-[#3B4A54] mb-1 overflow-hidden cursor-pointer" onClick={() => window.open(message.fileUrl, '_blank')}>
                              <img src={message.fileUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          {message.type === MessageType.VIDEO && message.fileUrl && (
                            <video src={message.fileUrl} controls className="max-w-full rounded-md mb-1" />
                          )}
                          {message.type === MessageType.AUDIO && message.fileUrl && (
                            <VoiceNotePlayer src={message.fileUrl} isSent={isSent} />
                          )}
                          {message.type === MessageType.FILE && message.fileUrl && (
                            <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#128C7E] hover:underline text-sm mb-1">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                              Download File
                            </a>
                          )}
                          {message.content && (
                            <div className="text-[14.2px] leading-[1.35] pr-[50px] text-gray-900 dark:text-[#E9EDEF]">{message.content}</div>
                          )}
                        </>
                      )}

                      <div className="flex items-center justify-end gap-1 -mt-0.5 float-right pl-3 relative bottom-[-4px]">
                        {message.isPinned && (
                          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                        )}
                        {message.editedAt && !message.deletedForEveryone && <span className="text-[11px] text-gray-400 dark:text-[#667781] italic">edited</span>}
                        <span className="text-[11px] text-gray-500 dark:text-[#8696A0] whitespace-nowrap">{formatMessageTime(message.createdAt)}</span>
                        {isSent && renderReadReceipt(message)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start mb-0.5">
            <div className="bg-white dark:bg-[#202C33] rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed bg-white dark:bg-[#233138] rounded-lg shadow-xl py-1.5 min-w-[200px] z-[1000]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const msg = messages.find((m: any) => m.id === contextMenu.msgId)
              const isDeleted = msg?.deletedForEveryone
              return !isDeleted
            })() && (
              <>
                <button
                  onClick={() => {
                    const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                    if (msg) setReplyingTo(msg)
                    setContextMenu(null)
                  }}
                  className="w-full px-5 py-2.5 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                  Reply
                </button>
                <button
                  onClick={() => {
                    const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                    if (msg?.content) navigator.clipboard?.writeText(msg.content)
                    setContextMenu(null)
                  }}
                  className="w-full px-5 py-2.5 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                  Copy
                </button>
                {(() => {
                  const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                  return msg && msg.senderId === user?.id && msg.type === MessageType.TEXT && !msg.isTask
                })() && (
                  <button
                    onClick={() => {
                      const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                      if (msg) {
                        setEditingMessage({ id: msg.id, chatId: msg.chatId, content: msg.content || '' })
                        setMessageText(msg.content || '')
                        setReplyingTo(null)
                        setTimeout(() => inputRef.current?.focus(), 50)
                      }
                      setContextMenu(null)
                    }}
                    className="w-full px-5 py-2.5 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    Edit
                  </button>
                )}
                {canPin && (
                  <button
                    onClick={() => {
                      pinMutation.mutate(contextMenu.msgId)
                      setContextMenu(null)
                    }}
                    className="w-full px-5 py-2.5 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                  >
                    {(() => {
                      const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                      return msg?.isPinned ? (
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      )
                    })()}
                    {(() => {
                      const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                      return msg?.isPinned ? 'Unpin' : 'Pin'
                    })()}
                  </button>
                )}
                {isAdmin && (() => {
                  const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                  return msg && !msg.isTask
                })() && (
                  <>
                    <div className="border-t border-gray-200 dark:border-[#3B4A54] my-1" />
                    <button
                      onClick={() => {
                        const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                        if (msg) {
                          setSelectedMessage(msg)
                          setShowConvertModal(true)
                        }
                        setContextMenu(null)
                      }}
                      className="w-full px-5 py-2.5 text-left text-sm text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      Convert to Task
                    </button>
                  </>
                )}
              </>
            )}
            {/* Delete options */}
            {(() => {
              const msg = messages.find((m: any) => m.id === contextMenu.msgId)
              return msg && !msg.isTask
            })() && (
              <>
                <div className="border-t border-gray-200 dark:border-[#3B4A54] my-1" />
                <button
                  onClick={() => {
                    if (window.confirm('Delete this message for you?')) {
                      deleteForMeMutation.mutate(contextMenu.msgId)
                    }
                    setContextMenu(null)
                  }}
                  className="w-full px-5 py-2.5 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  Delete for me
                </button>
                {(() => {
                  const msg = messages.find((m: any) => m.id === contextMenu.msgId)
                  return msg && msg.senderId === user?.id && !msg.deletedForEveryone &&
                    Date.now() - new Date(msg.createdAt).getTime() < 60 * 60 * 1000
                })() && (
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this message for everyone? This cannot be undone.')) {
                        deleteForEveryoneMutation.mutate(contextMenu.msgId)
                      }
                      setContextMenu(null)
                    }}
                    className="w-full px-5 py-2.5 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-[#3B4A54] flex items-center gap-3.5"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    Delete for everyone
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#1f2c33] border-t border-gray-200 dark:border-[#3B4A54] flex items-center gap-3 z-10">
          <div className="w-1 h-10 bg-[#128C7E] rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#128C7E] font-medium">{replyingTo.sender?.name || 'You'}</p>
            <p className="text-sm text-gray-500 dark:text-[#8696A0] truncate">{replyingTo.content || `[${replyingTo.type}]`}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/></svg>
          </button>
        </div>
      )}

      {/* Edit preview */}
      {editingMessage && (
        <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#1f2c33] border-t border-gray-200 dark:border-[#3B4A54] flex items-center gap-3 z-10">
          <div className="w-1 h-10 bg-[#1565c0] rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#1565c0] font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              Editing
            </p>
            <p className="text-sm text-gray-500 dark:text-[#8696A0] truncate">{editingMessage.content}</p>
          </div>
          <button onClick={() => { setEditingMessage(null); setMessageText('') }} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/></svg>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#f0f2f5] dark:bg-[#202C33] z-10">
        {uploadingFile && (
          <div className="absolute bottom-16 left-4 flex items-center gap-2 text-gray-500 text-sm bg-white dark:bg-[#1f2c33] rounded-lg px-3 py-1.5 shadow">
            <div className="animate-spin w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full" />
            Uploading...
          </div>
        )}

        {isRecordingVoice ? (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-[#8696A0] dark:hover:text-[#E9EDEF] flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159z"/>
              </svg>
            </button>
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-[#8696A0] dark:hover:text-[#E9EDEF]"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.501.501 1.155.812 1.805.869.681.06 1.298-.161 1.728-.59l5.522-5.524.472.471-5.522 5.523c-.576.577-1.381.884-2.26.808-.941-.081-1.861-.471-2.524-1.136-1.336-1.336-1.469-3.231-.299-4.404l7.916-7.916c1.097-1.097 2.91-1.004 4.103.191.594.594.967 1.332 1.024 2.036.058.692-.227 1.392-.796 1.961l-9.548 9.548a3.953 3.953 0 01-2.827 1.168 3.96 3.96 0 01-2.826-1.17 3.96 3.96 0 01-1.17-2.826 3.96 3.96 0 011.17-2.826L12.793 5.25l.471.471-8.37 8.369a2.332 2.332 0 00-.686 1.665z"/>
                </svg>
              </button>
              {showAttachMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#233138] rounded-lg shadow-lg py-2 z-20 w-48">
                    <label className="flex items-center gap-3 px-4 py-2 text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] cursor-pointer text-sm">
                      Photos
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, MessageType.IMAGE)} />
                    </label>
                    <label className="flex items-center gap-3 px-4 py-2 text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] cursor-pointer text-sm">
                      Videos
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, MessageType.VIDEO)} />
                    </label>
                    <label className="flex items-center gap-3 px-4 py-2 text-gray-800 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#3B4A54] cursor-pointer text-sm">
                      Document
                      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, MessageType.FILE)} />
                    </label>
                  </div>
                </>
              )}
            </div>
            <form onSubmit={handleSend} className="flex-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={messageText}
                onChange={handleInputChange}
                placeholder="Type a message"
                className="flex-1 bg-white dark:bg-[#2A3942] text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg px-4 py-2.5 outline-none text-[15px]"
              />
              {messageText.trim() ? (
                <button type="submit" disabled={sendMessageMutation.isPending} className="w-[42px] h-[42px] bg-[#075E54] hover:bg-[#128C7E] text-white rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRecordingVoice(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-[#8696A0] dark:hover:text-[#E9EDEF] flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2z"/></svg>
                </button>
              )}
            </form>
          </>
        )}
      </div>

      {/* Task Details slide-in panel */}
      {taskDetailId && (
        <TaskDetailsPanel
          taskId={taskDetailId}
          chatId={chatId!}
          onClose={() => setTaskDetailId(null)}
        />
      )}

      {/* Convert to Task Modal */}
      {selectedMessage && (
        <ConvertToTaskModal
          isOpen={showConvertModal}
          onClose={() => { setShowConvertModal(false); setSelectedMessage(null); }}
          message={{ id: selectedMessage.id, content: selectedMessage.content, chatId: chatId! }}
          members={chat?.members || []}
        />
      )}
    </div>
  )
}
