import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, Plus, Send, Phone, FileText, X, Mic, Square, Search, Filter } from 'lucide-react'
import Avatar from '../components/Avatar'
import TaskCard from '../components/TaskCard'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import { Chat, ChatType, Message, MessageType, TaskStatus } from '../types'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import { getSocket, joinChat, leaveChat, emitTyping } from '../services/socket'
import { api } from '../services/api'
import { format, parseISO, isToday, isYesterday } from 'date-fns'

interface ChatScreenProps {
  chat: Chat
  onBack: () => void
  onTaskDetail: (taskId: string) => void
  onGroupInfo: () => void
  onConvertToTask: (messageId: string, messageText: string) => void
}

function getChatDisplayName(chat: Chat, uid: string): string {
  if (chat.type === ChatType.GROUP) return chat.name
  const other = chat.members?.find((m) => m.userId !== uid)
  return other?.user?.name || chat.name || 'Chat'
}

function formatDateSep(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'MMMM d, yyyy')
  } catch {
    return ''
  }
}

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const TASK_FILTER_OPTIONS = ['All', 'Pending', 'In Progress', 'Overdue', 'Completed'] as const

export default function ChatScreen({ chat, onBack, onTaskDetail, onGroupInfo, onConvertToTask }: ChatScreenProps) {
  const [text, setText] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string; isTask: boolean; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; text: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore((s) => s.user)
  const { messages, fetchMessages, addMessage } = useChatStore()
  const chatMessages = messages[chat.id] || []
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const lastTypingEmitRef = useRef(0)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tasks-only filter state
  const [tasksOnly, setTasksOnly] = useState(false)
  const [taskFilter, setTaskFilter] = useState<typeof TASK_FILTER_OPTIONS[number]>('All')

  // Read receipts state
  const [readReceipts, setReadReceipts] = useState<Record<string, string[]>>({})

  useEffect(() => {
    fetchMessages(chat.id)
    joinChat(chat.id)
    const socket = getSocket()
    const handler = (data: { chatId: string; message: Message }) => {
      if (data.chatId === chat.id) addMessage(chat.id, data.message)
    }
    const typingHandler = (data: { chatId: string; userId: string; userName: string }) => {
      if (data.chatId === chat.id && data.userId !== user?.id) {
        setTypingUsers((prev) => {
          if (prev.includes(data.userName)) return prev
          return [...prev, data.userName]
        })
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== data.userName))
        }, 3000)
      }
    }
    const readHandler = (data: { chatId: string; messageIds: string[]; userId: string }) => {
      if (data.chatId === chat.id) {
        setReadReceipts((prev) => {
          const updated = { ...prev }
          data.messageIds.forEach((mid) => {
            const existing = updated[mid] || []
            if (!existing.includes(data.userId)) {
              updated[mid] = [...existing, data.userId]
            }
          })
          return updated
        })
      }
    }
    socket?.on('new_message', handler)
    socket?.on('typing', typingHandler)
    socket?.on('messages_read', readHandler)
    return () => {
      leaveChat(chat.id)
      socket?.off('new_message', handler)
      socket?.off('typing', typingHandler)
      socket?.off('messages_read', readHandler)
    }
  }, [chat.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [chatMessages.length])

  // Emit typing events
  const handleTextChange = useCallback((value: string) => {
    setText(value)
    const now = Date.now()
    if (now - lastTypingEmitRef.current > 2000) {
      emitTyping(chat.id)
      lastTypingEmitRef.current = now
    }
  }, [chat.id])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    const replyId = replyTo?.id
    setReplyTo(null)
    try {
      const response = await api.post(`/api/chats/${chat.id}/messages`, {
        content: trimmed,
        type: MessageType.TEXT,
        ...(replyId ? { replyToMessageId: replyId } : {}),
      })
      addMessage(chat.id, response.data.data)
    } catch {
      // message failed
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await api.post('/api/upload', formData)
      const { url } = uploadRes.data.data
      const type = file.type.startsWith('image/') ? MessageType.IMAGE
        : file.type.startsWith('video/') ? MessageType.VIDEO
        : file.type.startsWith('audio/') ? MessageType.AUDIO
        : MessageType.FILE
      const response = await api.post(`/api/chats/${chat.id}/messages`, {
        content: file.name,
        type,
        fileUrl: url,
      })
      addMessage(chat.id, response.data.data)
    } catch {
      // upload failed
    } finally {
      setUploading(false)
    }
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (audioChunksRef.current.length === 0) return
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        setUploading(true)
        try {
          const formData = new FormData()
          formData.append('file', blob, 'voice-note.webm')
          const uploadRes = await api.post('/api/upload', formData)
          const { url } = uploadRes.data.data
          const response = await api.post(`/api/chats/${chat.id}/messages`, {
            content: 'Voice note',
            type: MessageType.AUDIO,
            fileUrl: url,
          })
          addMessage(chat.id, response.data.data)
        } catch {
          // upload failed
        } finally {
          setUploading(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch {
      // mic permission denied
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
    }
    audioChunksRef.current = []
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  // Search
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/chats/${chat.id}/messages/search`, { params: { q: query } })
        setSearchResults(res.data.data || [])
      } catch {
        setSearchResults([])
      }
    }, 500)
  }

  const startLongPress = (e: React.TouchEvent, msgId: string, isTask: boolean, msgText: string) => {
    longPressTimerRef.current = setTimeout(() => {
      const touch = e.touches[0]
      setContextMenu({
        x: Math.min(touch.clientX, window.innerWidth - 220),
        y: Math.min(touch.clientY, window.innerHeight - 200),
        msgId,
        isTask,
        text: msgText,
      })
    }, 500)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleContextMenu = (e: React.MouseEvent, msgId: string, isTask: boolean, msgText: string) => {
    e.preventDefault()
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 200),
      msgId,
      isTask,
      text: msgText,
    })
  }

  // Filter messages for tasks-only view
  let displayMessages = chatMessages
  if (tasksOnly) {
    displayMessages = chatMessages.filter((m) => m.isTask && m.task)
    if (taskFilter !== 'All') {
      displayMessages = displayMessages.filter((m) => {
        const task = m.task!
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.APPROVED && task.status !== TaskStatus.COMPLETED
        switch (taskFilter) {
          case 'Pending': return task.status === TaskStatus.PENDING
          case 'In Progress': return task.status === TaskStatus.IN_PROGRESS
          case 'Overdue': return isOverdue
          case 'Completed': return task.status === TaskStatus.COMPLETED || task.status === TaskStatus.APPROVED
          default: return true
        }
      })
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let lastDate = ''
  displayMessages.forEach((m) => {
    const dateStr = m.createdAt?.split('T')[0] || ''
    if (dateStr !== lastDate) {
      lastDate = dateStr
      groupedMessages.push({ date: m.createdAt, messages: [m] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(m)
    }
  })

  const displayName = getChatDisplayName(chat, user?.id || '')
  const subtitle = chat.type === ChatType.GROUP
    ? chat.members?.map((m) => m.user?.name).filter(Boolean).join(', ')
    : 'online'

  // Get other user for DM read receipts
  const otherUserId = chat.type === ChatType.DIRECT
    ? chat.members?.find((m) => m.userId !== user?.id)?.userId
    : null

  const getReadStatus = (msg: Message): 'sent' | 'delivered' | 'read' => {
    if (msg.senderId !== user?.id) return 'sent'
    const msgReaders = msg.readBy || readReceipts[msg.id] || []
    if (chat.type === ChatType.DIRECT && otherUserId) {
      return msgReaders.includes(otherUserId) ? 'read' : 'delivered'
    }
    return msgReaders.length > 0 ? 'read' : 'delivered'
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-chatbg dark:bg-[#1a1a1a] animate-slide-in z-20">
      {/* Nav */}
      <div className="ios-blur border-b border-black/[0.12] dark:border-white/[0.15] pt-safe shrink-0 z-10">
        <div className="flex items-center h-11 px-2">
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Chats</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={chat.type === ChatType.GROUP ? onGroupInfo : undefined}>
            <Avatar name={displayName} size={32} />
            <div className="min-w-0">
              <div className="text-[16px] font-semibold truncate dark:text-white">{displayName}</div>
              <div className="text-[12px] text-gray-400 truncate">{subtitle}</div>
            </div>
          </div>
          <button
            className={`p-2 ${tasksOnly ? 'text-wgreen' : 'text-blue-500'}`}
            onClick={() => { setTasksOnly(!tasksOnly); setTaskFilter('All') }}
            title="Tasks only"
          >
            <Filter size={20} />
          </button>
          <button
            className="text-blue-500 p-2"
            onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); setSearchResults([]) }}
          >
            <Search size={20} />
          </button>
          <button className="text-blue-500 p-2 opacity-40" onClick={() => alert('Calling is not available in MVP')}>
            <Phone size={20} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="bg-white dark:bg-[#1C1C1E] border-b border-black/[0.08] dark:border-white/[0.1] px-3 py-2 shrink-0 relative">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search messages..."
            className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-lg px-3 py-2 text-[15px] outline-none dark:text-white placeholder-gray-400"
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full bg-white dark:bg-[#1C1C1E] border-b border-black/[0.08] dark:border-white/[0.1] max-h-[300px] overflow-y-auto z-50 shadow-lg">
              {searchResults.map((msg) => (
                <button
                  key={msg.id}
                  className="w-full text-left px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] active:bg-gray-100 dark:active:bg-gray-800"
                  onClick={() => {
                    setShowSearch(false)
                    setSearchQuery('')
                    setSearchResults([])
                    const el = document.getElementById(`msg-${msg.id}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30')
                      setTimeout(() => el.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30'), 2000)
                    }
                  }}
                >
                  <div className="text-[13px] text-gray-400">{msg.sender?.name} - {msg.createdAt ? format(parseISO(msg.createdAt), 'MMM d, h:mm a') : ''}</div>
                  <div className="text-[15px] dark:text-white truncate">{msg.content}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task filter pills */}
      {tasksOnly && (
        <div className="bg-white/80 dark:bg-[#1C1C1E]/80 border-b border-black/[0.08] dark:border-white/[0.1] px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
          {TASK_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setTaskFilter(opt)}
              className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap ${
                taskFilter === opt
                  ? 'bg-wgreen text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch px-3 py-2">
        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            <div className="text-center my-3">
              <span className="inline-block bg-black/5 dark:bg-white/10 text-gray-500 text-[12px] font-medium px-3 py-1 rounded-lg">
                {formatDateSep(group.date)}
              </span>
            </div>
            {group.messages.map((msg) => {
              const isSent = msg.senderId === user?.id
              const readStatus = getReadStatus(msg)
              return (
                <div key={msg.id} id={`msg-${msg.id}`} className={`flex mb-0.5 transition-colors duration-500 ${isSent ? 'justify-end' : 'justify-start'}`}>
                  {msg.isTask && msg.task ? (
                    <TaskCard task={msg.task} onClick={() => onTaskDetail(msg.task!.id)} />
                  ) : (
                    <div
                      className={`max-w-[78%] px-2 py-1.5 rounded-xl text-[16px] leading-[1.35] break-words ${
                        isSent
                          ? 'bg-sent dark:bg-[#056162] rounded-tr-sm'
                          : 'bg-white dark:bg-[#1C1C1E] rounded-tl-sm'
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, msg.id, false, msg.content || '')}
                      onTouchStart={(e) => startLongPress(e, msg.id, false, msg.content || '')}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                    >
                      {!isSent && chat.type === ChatType.GROUP && (
                        <div className="text-[13px] font-semibold text-teal-light mb-0.5">{msg.sender?.name}</div>
                      )}
                      {msg.type === MessageType.IMAGE && msg.fileUrl ? (
                        <img src={msg.fileUrl} alt={msg.content || ''} className="max-w-full rounded-lg" />
                      ) : msg.type === MessageType.VIDEO && msg.fileUrl ? (
                        <video src={msg.fileUrl} controls className="max-w-full rounded-lg" />
                      ) : msg.type === MessageType.AUDIO && msg.fileUrl ? (
                        <VoiceNotePlayer src={msg.fileUrl} />
                      ) : msg.type === MessageType.FILE && msg.fileUrl ? (
                        <a href={msg.fileUrl} download className="flex items-center gap-1.5 text-blue-500 underline">
                          <FileText size={16} />
                          <span>{msg.content || 'Download file'}</span>
                        </a>
                      ) : (
                        <span className="dark:text-white">{msg.content}</span>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-[11px] text-gray-400">{msg.createdAt ? format(parseISO(msg.createdAt), 'h:mm a') : ''}</span>
                        {isSent && (
                          <span className={`text-[12px] ${readStatus === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
                            {readStatus === 'sent' ? '\u2713' : '\u2713\u2713'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 shrink-0">
          <span className="text-[13px] text-gray-400 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
            <span className="inline-flex ml-0.5">
              <span className="animate-bounce inline-block" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-bounce inline-block" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-bounce inline-block" style={{ animationDelay: '300ms' }}>.</span>
            </span>
          </span>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="bg-gray-100 dark:bg-[#2C2C2E] border-t border-black/[0.08] dark:border-white/[0.1] px-3 py-2 flex items-center gap-2 shrink-0">
          <div className="w-1 h-8 bg-teal rounded-full shrink-0" />
          <div className="flex-1 min-w-0 text-[14px] text-gray-500 dark:text-gray-400 truncate">{replyTo.text}</div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 text-gray-400 p-0.5">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Recording UI */}
      {isRecording ? (
        <div className="bg-gray-100 dark:bg-[#2C2C2E] border-t border-black/[0.08] dark:border-white/[0.1] px-3 py-3 pb-safe flex items-center gap-3 shrink-0">
          <button onClick={cancelRecording} className="text-gray-400 p-2">
            <X size={22} />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[17px] font-mono text-red-500">{formatRecordingTime(recordingTime)}</span>
          </div>
          <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
            <Square size={16} className="text-white" fill="white" />
          </button>
        </div>
      ) : (
        /* Input */
        <div className={`bg-gray-100 dark:bg-[#2C2C2E] ${replyTo ? '' : 'border-t border-black/[0.08] dark:border-white/[0.1]'} px-2 py-1.5 pb-safe flex items-end gap-1.5 shrink-0`}>
          <button
            className="w-9 h-9 flex items-center justify-center text-blue-500 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus size={24} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            rows={1}
            className="flex-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] rounded-[18px] px-3.5 py-2 text-[17px] outline-none max-h-[100px] overflow-y-auto resize-none leading-[1.3] dark:text-white placeholder-gray-400"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 100) + 'px'
            }}
          />
          {text.trim() ? (
            <button onClick={handleSend} className="w-9 h-9 rounded-full bg-wgreen flex items-center justify-center shrink-0">
              <Send size={18} className="text-white" />
            </button>
          ) : (
            <button onClick={startRecording} className="w-9 h-9 rounded-full bg-wgreen flex items-center justify-center shrink-0">
              <Mic size={18} className="text-white" />
            </button>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed bg-white dark:bg-[#2C2C2E] rounded-[14px] shadow-lg z-[90] min-w-[200px] overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => { setReplyTo({ id: contextMenu.msgId, text: contextMenu.text }); setContextMenu(null) }} className="flex items-center gap-2.5 px-4 py-3 text-[16px] w-full text-left dark:text-white active:bg-gray-100 dark:active:bg-gray-700">
              Reply
            </button>
            {!contextMenu.isTask && isAdmin && (
              <button
                onClick={() => {
                  onConvertToTask(contextMenu.msgId, contextMenu.text)
                  setContextMenu(null)
                }}
                className="flex items-center gap-2.5 px-4 py-3 text-[16px] w-full text-left border-t border-black/[0.08] dark:border-white/[0.1] dark:text-white active:bg-gray-100 dark:active:bg-gray-700"
              >
                Convert to Task
              </button>
            )}
            <button onClick={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null) }} className="flex items-center gap-2.5 px-4 py-3 text-[16px] w-full text-left border-t border-black/[0.08] dark:border-white/[0.1] dark:text-white active:bg-gray-100 dark:active:bg-gray-700">
              Copy
            </button>
          </div>
        </>
      )}
    </div>
  )
}
