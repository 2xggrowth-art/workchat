import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  ActionSheetIOS,
  Alert,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Audio, Video, ResizeMode } from 'expo-av'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../services/api'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import { useTheme } from '../contexts/ThemeContext'
import ConvertToTaskModal from '../components/chat/ConvertToTaskModal'
import TaskDetailsModal from '../components/task/TaskDetailsModal'

interface Message {
  id: string
  content: string
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'
  fileUrl?: string
  senderId: string
  sender?: {
    id: string
    name: string
    emoji?: string
  }
  createdAt: string
  isTask: boolean
  task?: {
    id: string
    status: string
    title: string
    priority?: string
    dueDate?: string
    owner?: { id: string; name: string }
    steps?: Array<{ id: string; completedAt?: string }>
  }
  replyTo?: {
    content: string
    sender?: {
      name: string
    }
  }
  readBy?: string[]
  deliveredTo?: string[]
}

interface RouteParams {
  chatId: string
  chatName?: string
}

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: '#2196F3',
  IN_PROGRESS: '#FFC107',
  COMPLETED: '#4CAF50',
  APPROVED: '#4CAF50',
  REOPENED: '#9C27B0',
}

const TASK_STATUS_BG: Record<string, string> = {
  PENDING: 'rgba(33,150,243,0.1)',
  IN_PROGRESS: 'rgba(255,193,7,0.1)',
  COMPLETED: 'rgba(76,175,80,0.1)',
  APPROVED: 'rgba(76,175,80,0.1)',
  REOPENED: 'rgba(156,39,176,0.1)',
}

const SENDER_COLORS = ['#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FF5722', '#795548', '#607D8B', '#2196F3']

function getSenderColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length]
}

export default function ChatScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { chatId, chatName } = route.params as RouteParams
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId)
  const { colors } = useTheme()

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<any>(null)
  const [taskFilterActive, setTaskFilterActive] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  // Long-press menu state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showMessageMenu, setShowMessageMenu] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)

  // Task details modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  // Reply state
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // Voice recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const soundRef = useRef<Audio.Sound | null>(null)

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kebab menu state
  const [showKebabMenu, setShowKebabMenu] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)

  // Video modal state
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null)

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/api/chats/${chatId}/messages`)
      setMessages((response.data.data || []).reverse())
    } catch (error) {
      if (__DEV__) console.error('Failed to fetch messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChat = async () => {
    try {
      const response = await api.get(`/api/chats/${chatId}`)
      setChat(response.data.data)
    } catch (error) {
      if (__DEV__) console.error('Failed to fetch chat:', error)
    }
  }

  const markChatAsRead = async () => {
    try {
      await api.post(`/api/chats/${chatId}/mark-read`)
    } catch (error) {
      if (__DEV__) console.error('Failed to mark chat as read:', error)
    }
  }

  useEffect(() => {
    setCurrentChatId(chatId)
    fetchChat()
    fetchMessages()
    markChatAsRead()
    socketService.joinChat(chatId)

    const unsubscribeNewMessage = socketService.on('new_message', (data: { chatId: string; message: Message }) => {
      if (data.chatId === chatId) {
        if (data.message.senderId === user?.id) return
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id)
          if (exists) return prev
          return [...prev, data.message]
        })
        markChatAsRead()
      }
    })

    const unsubscribeTaskConversion = socketService.on('message_converted_to_task', (data: { chatId: string; messageId: string; task: any }) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, isTask: true, task: data.task }
              : m
          )
        )
      }
    })

    const unsubscribeTaskStatusChanged = socketService.on('task_status_changed', (data: { chatId: string; messageId: string; taskId: string; status: string }) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId && m.task
              ? { ...m, task: { ...m.task, status: data.status } }
              : m
          )
        )
      }
    })

    // Typing indicator listener
    const unsubscribeTyping = socketService.on('user_typing', (data: { chatId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.chatId === chatId && data.userId !== user?.id) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            return prev.includes(data.userName) ? prev : [...prev, data.userName]
          } else {
            return prev.filter((n) => n !== data.userName)
          }
        })
      }
    })

    // Read receipts listener
    const unsubscribeRead = socketService.on('messages_read', (data: { chatId: string; userId: string; messageIds?: string[] }) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.senderId === user?.id) {
              const readBy = m.readBy ? [...m.readBy] : []
              if (!readBy.includes(data.userId)) readBy.push(data.userId)
              return { ...m, readBy }
            }
            return m
          })
        )
      }
    })

    return () => {
      setCurrentChatId(null)
      socketService.leaveChat(chatId)
      unsubscribeNewMessage()
      unsubscribeTaskConversion()
      unsubscribeTaskStatusChanged()
      unsubscribeTyping()
      unsubscribeRead()
      if (soundRef.current) {
        soundRef.current.unloadAsync()
      }
    }
  }, [chatId])

  useFocusEffect(
    useCallback(() => {
      fetchMessages()
      socketService.joinChat(chatId)
      markChatAsRead()
    }, [chatId])
  )

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  // Flush offline queue on mount
  useEffect(() => {
    flushOfflineQueue()
  }, [])

  // Typing indicator emission
  const handleTextChange = (text: string) => {
    setMessage(text)
    socketService.sendTyping(chatId, true)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socketService.sendTyping(chatId, false)
    }, 3000)
  }

  // Search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    searchTimeout.current = setTimeout(() => {
      const results = messages.filter((m) =>
        m.content?.toLowerCase().includes(query.toLowerCase())
      )
      setSearchResults(results)
    }, 300)
  }

  // Offline queue
  const flushOfflineQueue = async () => {
    try {
      const queueJson = await AsyncStorage.getItem('workchat-offline-queue')
      if (!queueJson) return
      const queue = JSON.parse(queueJson) as Array<{ chatId: string; content: string; type: string }>
      await AsyncStorage.removeItem('workchat-offline-queue')
      for (const item of queue) {
        try {
          await api.post(`/api/chats/${item.chatId}/messages`, item)
        } catch {
          // Re-queue if still offline
          const remaining = await AsyncStorage.getItem('workchat-offline-queue')
          const arr = remaining ? JSON.parse(remaining) : []
          arr.push(item)
          await AsyncStorage.setItem('workchat-offline-queue', JSON.stringify(arr))
          break
        }
      }
    } catch {
      // ignore
    }
  }

  const queueOfflineMessage = async (content: string) => {
    const queueJson = await AsyncStorage.getItem('workchat-offline-queue')
    const queue = queueJson ? JSON.parse(queueJson) : []
    queue.push({ chatId, content, type: 'TEXT' })
    await AsyncStorage.setItem('workchat-offline-queue', JSON.stringify(queue))
  }

  const handleSend = async () => {
    if (!message.trim() || sending) return
    const msgText = message.trim()
    setSending(true)
    setMessage('')
    setReplyTo(null)
    socketService.sendTyping(chatId, false)

    try {
      const response = await api.post(`/api/chats/${chatId}/messages`, {
        content: msgText,
        type: 'TEXT',
        ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
      })
      setMessages((prev) => [...prev, response.data.data])
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (error) {
      if (__DEV__) console.error('Failed to send message:', error)
      await queueOfflineMessage(msgText)
      Alert.alert('Offline', 'Message queued and will be sent when connection is restored.')
    } finally {
      setSending(false)
    }
  }

  // Media upload
  const uploadFile = async (uri: string, type: string): Promise<string | null> => {
    setUploading(true)
    try {
      const formData = new FormData()
      const filename = uri.split('/').pop() || 'file'
      const ext = filename.split('.').pop() || ''
      let mimeType = 'application/octet-stream'
      if (type === 'IMAGE') mimeType = `image/${ext === 'png' ? 'png' : 'jpeg'}`
      else if (type === 'VIDEO') mimeType = `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
      else if (type === 'AUDIO') mimeType = `audio/${ext === 'caf' ? 'x-caf' : ext === 'm4a' ? 'mp4' : ext}`

      formData.append('file', {
        uri,
        name: filename,
        type: mimeType,
      } as any)

      const response = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data.data?.url || response.data.url || null
    } catch (error) {
      if (__DEV__) console.error('Upload failed:', error)
      Alert.alert('Error', 'Failed to upload file')
      return null
    } finally {
      setUploading(false)
    }
  }

  const sendMediaMessage = async (fileUrl: string, type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE', content?: string) => {
    try {
      const response = await api.post(`/api/chats/${chatId}/messages`, {
        content: content || type.toLowerCase(),
        type,
        fileUrl,
      })
      setMessages((prev) => [...prev, response.data.data])
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (error) {
      if (__DEV__) console.error('Failed to send media message:', error)
    }
  }

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      const url = await uploadFile(result.assets[0].uri, 'IMAGE')
      if (url) await sendMediaMessage(url, 'IMAGE')
    }
  }

  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.5,
      videoMaxDuration: 120,
    })
    if (!result.canceled && result.assets[0]) {
      const url = await uploadFile(result.assets[0].uri, 'VIDEO')
      if (url) await sendMediaMessage(url, 'VIDEO')
    }
  }

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' })
    if (!result.canceled && result.assets[0]) {
      const url = await uploadFile(result.assets[0].uri, 'FILE')
      if (url) await sendMediaMessage(url, 'FILE', result.assets[0].name)
    }
  }

  const showAttachmentMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo', 'Video', 'File'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handlePickImage()
          else if (buttonIndex === 2) handlePickVideo()
          else if (buttonIndex === 3) handlePickDocument()
        }
      )
    } else {
      Alert.alert('Attach', 'Choose attachment type', [
        { text: 'Photo', onPress: handlePickImage },
        { text: 'Video', onPress: handlePickVideo },
        { text: 'File', onPress: handlePickDocument },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow microphone access.')
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(rec)
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimer.current = setInterval(() => {
        setRecordingDuration((d) => d + 1)
      }, 1000)
    } catch (error) {
      if (__DEV__) console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    if (recordingTimer.current) clearInterval(recordingTimer.current)
    setIsRecording(false)
    try {
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      const uri = recording.getURI()
      setRecording(null)
      if (uri) {
        const url = await uploadFile(uri, 'AUDIO')
        if (url) await sendMediaMessage(url, 'AUDIO')
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to stop recording:', error)
      setRecording(null)
    }
  }

  const cancelRecording = async () => {
    if (!recording) return
    if (recordingTimer.current) clearInterval(recordingTimer.current)
    setIsRecording(false)
    try {
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    } catch {
      // ignore
    }
    setRecording(null)
  }

  // Audio playback
  const playAudio = async (messageId: string, url: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }
      if (playingId === messageId) {
        setPlayingId(null)
        setPlaybackProgress(0)
        return
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            if (status.durationMillis && status.positionMillis) {
              setPlaybackProgress(status.positionMillis / status.durationMillis)
            }
            if (status.didJustFinish) {
              setPlayingId(null)
              setPlaybackProgress(0)
            }
          }
        }
      )
      soundRef.current = sound
      setPlayingId(messageId)
    } catch (error) {
      if (__DEV__) console.error('Playback error:', error)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const getDisplayName = () => {
    if (chatName) return chatName
    if (!chat) return 'Loading...'
    if (chat.type === 'GROUP') return chat.name
    const otherMember = chat.members?.find((m: any) => m.user.id !== user?.id)
    return otherMember?.user.name || chat.name
  }

  const getMemberCount = () => {
    if (!chat?.members) return ''
    return `${chat.members.length} members`
  }

  const canConvertToTask = () => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    if (!chat?.members) return false
    const currentMember = chat.members.find((m: any) => m.user.id === user.id)
    return currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN'
  }

  const handleMessageLongPress = (msg: Message) => {
    if (!msg.isTask) {
      setSelectedMessage(msg)
      setShowMessageMenu(true)
    }
  }

  const handleConvertToTask = () => {
    setShowMessageMenu(false)
    setShowConvertModal(true)
  }

  const handleTaskConversionSuccess = () => {
    setShowConvertModal(false)
    setSelectedMessage(null)
    fetchMessages()
  }

  const closeMessageMenu = () => {
    setShowMessageMenu(false)
    setSelectedMessage(null)
  }

  const getCurrentMemberRole = (): 'OWNER' | 'ADMIN' | 'MEMBER' | undefined => {
    if (!chat?.members || !user) return undefined
    const currentMember = chat.members.find((m: any) => m.user.id === user.id)
    return currentMember?.role
  }

  const handleTaskPress = (msg: Message) => {
    if (msg.isTask && msg.task?.id) {
      setSelectedTaskId(msg.task.id)
      setShowTaskModal(true)
    }
  }

  const closeTaskModal = () => {
    setShowTaskModal(false)
    setSelectedTaskId(null)
  }

  const handleTaskUpdated = () => {
    fetchMessages()
  }

  const isOverdue = (task: Message['task']) => {
    if (!task?.dueDate) return false
    if (task.status === 'COMPLETED' || task.status === 'APPROVED') return false
    return new Date(task.dueDate) < new Date()
  }

  const getTaskStatusColor = (task: Message['task']) => {
    if (!task) return '#2196F3'
    if (isOverdue(task)) return '#F44336'
    return TASK_STATUS_COLORS[task.status] || '#2196F3'
  }

  const getTaskStatusLabel = (task: Message['task']) => {
    if (!task) return 'PENDING'
    if (isOverdue(task)) return 'OVERDUE'
    return task.status.replace('_', ' ')
  }

  // Read receipt indicators
  const getReadStatus = (msg: Message) => {
    if (msg.senderId !== user?.id) return null
    const otherMemberCount = (chat?.members?.length || 1) - 1
    const readCount = msg.readBy?.length || 0
    const deliveredCount = msg.deliveredTo?.length || 0
    if (readCount > 0 && readCount >= otherMemberCount) return 'read'
    if (deliveredCount > 0 || readCount > 0) return 'delivered'
    return 'sent'
  }

  const filteredMessages = taskFilterActive
    ? messages.filter((m) => m.isTask)
    : messages

  const displayMessages = showSearch && searchQuery ? searchResults : filteredMessages

  const renderTaskCard = (item: Message) => {
    const task = item.task!
    const statusColor = getTaskStatusColor(task)
    const statusLabel = getTaskStatusLabel(task)
    const statusBg = isOverdue(task) ? 'rgba(244,67,54,0.1)' : TASK_STATUS_BG[task.status] || 'rgba(33,150,243,0.1)'
    const stepsTotal = task.steps?.length || 0
    const stepsDone = task.steps?.filter((s) => s.completedAt).length || 0

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => handleTaskPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.taskCardInner}>
          <View style={[styles.taskCardBorder, { backgroundColor: statusColor }]} />
          <View style={styles.taskCardContent}>
            <View style={styles.taskCardHeader}>
              <Text style={styles.taskCardIcon}>T</Text>
              <Text style={styles.taskCardTitle} numberOfLines={2}>{task.title}</Text>
            </View>
            {task.owner && (
              <Text style={styles.taskCardDetail}>Assigned to: {task.owner.name}</Text>
            )}
            {task.dueDate && (
              <Text style={[styles.taskCardDetail, isOverdue(task) && { color: '#F44336' }]}>
                Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            )}
            <View style={styles.taskCardFooter}>
              <View style={[styles.taskStatusBadge, { backgroundColor: statusBg }]}>
                <View style={[styles.taskStatusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.taskStatusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              {stepsTotal > 0 && (
                <Text style={styles.taskChecklistMini}>{stepsDone}/{stepsTotal} steps</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderVoiceNote = (item: Message) => {
    const isPlaying = playingId === item.id
    const progress = isPlaying ? playbackProgress : 0

    return (
      <View style={styles.voiceNote}>
        <TouchableOpacity
          style={styles.voicePlay}
          onPress={() => item.fileUrl && playAudio(item.id, item.fileUrl)}
        >
          <Text style={styles.voicePlayIcon}>{isPlaying ? '||' : '>'}</Text>
        </TouchableOpacity>
        <View style={styles.voiceWave}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
        <Text style={styles.voiceDuration}>{isPlaying ? `${Math.floor(progress * 100)}%` : 'Voice note'}</Text>
      </View>
    )
  }

  const renderVideoMessage = (item: Message) => {
    return (
      <TouchableOpacity
        style={styles.videoContainer}
        onPress={() => setVideoModalUrl(item.fileUrl || null)}
        activeOpacity={0.8}
      >
        <View style={styles.videoPlaceholder}>
          <View style={styles.videoPlayOverlay}>
            <Text style={styles.videoPlayIcon}>{'>'}</Text>
          </View>
          <Text style={styles.videoLabel}>Video</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderReadReceipt = (msg: Message) => {
    const status = getReadStatus(msg)
    if (!status) return <Text style={styles.msgCheck}>{'  '}</Text>
    if (status === 'read') return <Text style={[styles.msgCheck, { color: '#34B7F1' }]}>{'vv'}</Text>
    if (status === 'delivered') return <Text style={styles.msgCheck}>{'vv'}</Text>
    return <Text style={styles.msgCheck}>{'v'}</Text>
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id
    const canShowMenu = !item.isTask
    const isTask = item.isTask && item.task

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => isTask ? handleTaskPress(item) : undefined}
        onLongPress={() => canShowMenu && handleMessageLongPress(item)}
        delayLongPress={500}
        style={[styles.messageRow, isOwn ? styles.messageRowSent : styles.messageRowReceived]}
      >
        {/* Sender name for group chats */}
        {!isOwn && chat?.type === 'GROUP' && item.sender?.name && (
          <Text style={[styles.senderName, { color: getSenderColor(item.sender.name) }]}>
            {item.sender.emoji ? `${item.sender.emoji} ` : ''}{item.sender.name}
          </Text>
        )}

        {/* Task card rendering */}
        {isTask ? (
          renderTaskCard(item)
        ) : (
          <View
            style={[
              styles.messageBubble,
              isOwn
                ? [styles.bubbleSent, { backgroundColor: colors.bubbleSent }]
                : [styles.bubbleReceived, { backgroundColor: colors.bubbleReceived }],
            ]}
          >
            {/* Reply reference */}
            {item.replyTo && (
              <View style={styles.replyContainer}>
                <Text style={styles.replyName}>{item.replyTo.sender?.name || 'Unknown'}</Text>
                <Text style={styles.replyContent} numberOfLines={1}>{item.replyTo.content}</Text>
              </View>
            )}

            {/* Media content */}
            {item.type === 'IMAGE' && item.fileUrl && (
              <Image source={{ uri: item.fileUrl }} style={styles.messageImage} resizeMode="cover" />
            )}

            {/* Video content */}
            {item.type === 'VIDEO' && renderVideoMessage(item)}

            {/* Voice note */}
            {item.type === 'AUDIO' && renderVoiceNote(item)}

            {/* Text content */}
            {item.type === 'TEXT' && item.content && (
              <Text style={[styles.messageText, { color: colors.text }]}>{item.content}</Text>
            )}

            {/* File indicator */}
            {item.type === 'FILE' && (
              <View style={styles.fileIndicator}>
                <Text style={styles.fileIcon}>D</Text>
                <Text style={styles.fileName} numberOfLines={1}>{item.content || 'File'}</Text>
              </View>
            )}

            {/* Meta: time + read receipt */}
            <View style={styles.msgMeta}>
              <Text style={[styles.msgTime, { color: colors.textMuted }]}>{formatTime(item.createdAt)}</Text>
              {isOwn && renderReadReceipt(item)}
            </View>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
    </View>
  )

  const hasText = message.trim().length > 0

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.chatBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => {
            if (chat?.type === 'GROUP') {
              (navigation as any).navigate('GroupInfo', { chatId })
            } else {
              (navigation as any).navigate('ContactInfo', { chatId })
            }
          }}
        >
          <View style={[styles.headerAvatar, chat?.type === 'GROUP' && styles.groupAvatar]}>
            <Text style={styles.headerAvatarText}>
              {chat?.type === 'GROUP' ? 'G' : getDisplayName().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{getDisplayName()}</Text>
            {typingUsers.length > 0 ? (
              <Text style={styles.headerTyping}>
                {typingUsers.join(', ')} typing...
              </Text>
            ) : chat?.type === 'GROUP' ? (
              <Text style={styles.headerStatus}>{getMemberCount()}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Text style={styles.headerActionIcon}>S</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setTaskFilterActive(!taskFilterActive)}
        >
          <Text style={[styles.headerActionIcon, taskFilterActive && { color: '#25D366' }]}>F</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setShowKebabMenu(true)}
        >
          <Text style={styles.headerActionIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}>
            <Text style={styles.searchClose}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Task filter indicator */}
      {taskFilterActive && (
        <View style={styles.taskFilterBar}>
          <Text style={styles.taskFilterText}>Showing tasks only</Text>
          <TouchableOpacity onPress={() => setTaskFilterActive(false)}>
            <Text style={styles.taskFilterClose}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <View style={[styles.chatBg, { backgroundColor: colors.chatBg }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#128C7E" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.messagesList, displayMessages.length === 0 && styles.messagesListEmpty]}
            ListEmptyComponent={renderEmpty}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}
      </View>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingUsers.join(', ')} typing...</Text>
        </View>
      )}

      {/* Reply Preview Bar */}
      {replyTo && (
        <View style={[styles.replyPreviewBar, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewName}>{replyTo.sender?.name || 'You'}</Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyPreviewClose}>
            <Text style={styles.replyPreviewCloseText}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Upload indicator */}
      {uploading && (
        <View style={styles.uploadBar}>
          <ActivityIndicator size="small" color="#128C7E" />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
          <TouchableOpacity onPress={cancelRecording} style={styles.recordingCancel}>
            <Text style={styles.recordingCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={stopRecording} style={styles.recordingStop}>
            <Text style={styles.recordingStopText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      {!isRecording && (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 6, backgroundColor: colors.chatBg }]}>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg }]}>
            <TouchableOpacity style={styles.inputIcon} onPress={showAttachmentMenu}>
              <Text style={styles.inputIconText}>+</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              placeholder="Type a message"
              placeholderTextColor="#9E9E9E"
              value={message}
              onChangeText={handleTextChange}
              multiline
            />
          </View>
          {hasText ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendBtnIcon}>{'>'}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={startRecording}
              activeOpacity={0.7}
            >
              <Text style={styles.sendBtnIcon}>M</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Video Modal */}
      <Modal visible={!!videoModalUrl} transparent animationType="fade" onRequestClose={() => setVideoModalUrl(null)}>
        <View style={styles.videoModal}>
          <TouchableOpacity style={styles.videoModalClose} onPress={() => setVideoModalUrl(null)}>
            <Text style={styles.videoModalCloseText}>X</Text>
          </TouchableOpacity>
          {videoModalUrl && (
            <Video
              source={{ uri: videoModalUrl }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          )}
        </View>
      </Modal>

      {/* Message Action Menu (Context Menu style) */}
      <Modal
        visible={showMessageMenu}
        transparent
        animationType="fade"
        onRequestClose={closeMessageMenu}
      >
        <Pressable style={styles.menuOverlay} onPress={closeMessageMenu}>
          <View style={styles.contextMenu}>
            <TouchableOpacity style={styles.contextMenuItem} onPress={() => {
              setReplyTo(selectedMessage)
              setShowMessageMenu(false)
            }}>
              <Text style={styles.contextMenuIcon}>{'<'}</Text>
              <Text style={styles.contextMenuText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextMenuItem} onPress={closeMessageMenu}>
              <Text style={styles.contextMenuIcon}>{'>'}</Text>
              <Text style={styles.contextMenuText}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextMenuItem} onPress={closeMessageMenu}>
              <Text style={styles.contextMenuIcon}>C</Text>
              <Text style={styles.contextMenuText}>Copy</Text>
            </TouchableOpacity>
            {canConvertToTask() && (
              <TouchableOpacity
                style={[styles.contextMenuItem, styles.contextMenuHighlight]}
                onPress={handleConvertToTask}
              >
                <Text style={[styles.contextMenuIcon, { color: '#128C7E' }]}>T</Text>
                <Text style={[styles.contextMenuText, { color: '#128C7E' }]}>Convert to Task</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Kebab Menu Modal */}
      <Modal
        visible={showKebabMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKebabMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowKebabMenu(false)}>
          <View style={styles.contextMenu}>
            {/* Contact info / Group info */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                setShowKebabMenu(false)
                if (chat?.type === 'GROUP') {
                  (navigation as any).navigate('GroupInfo', { chatId })
                } else {
                  (navigation as any).navigate('ContactInfo', { chatId })
                }
              }}
            >
              <Text style={styles.contextMenuIcon}>{chat?.type === 'GROUP' ? 'G' : 'i'}</Text>
              <Text style={styles.contextMenuText}>{chat?.type === 'GROUP' ? 'Group info' : 'Contact info'}</Text>
            </TouchableOpacity>
            {/* Search messages */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => { setShowKebabMenu(false); setShowSearch(true) }}
            >
              <Text style={styles.contextMenuIcon}>S</Text>
              <Text style={styles.contextMenuText}>Search messages</Text>
            </TouchableOpacity>
            {/* Add to favourites */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={async () => {
                setShowKebabMenu(false)
                try {
                  await api.post(`/api/chats/${chatId}/favourite`)
                } catch {}
              }}
            >
              <Text style={styles.contextMenuIcon}>★</Text>
              <Text style={styles.contextMenuText}>Add to favourites</Text>
            </TouchableOpacity>
            {/* Close chat */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => { setShowKebabMenu(false); navigation.goBack() }}
            >
              <Text style={styles.contextMenuIcon}>✕</Text>
              <Text style={styles.contextMenuText}>Close chat</Text>
            </TouchableOpacity>
            {/* Report */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                setShowKebabMenu(false)
                Alert.alert('Report Submitted', 'We will review this chat.', [{ text: 'OK' }])
              }}
            >
              <Text style={styles.contextMenuIcon}>⚑</Text>
              <Text style={styles.contextMenuText}>Report</Text>
            </TouchableOpacity>
            {/* Block (1:1 only) */}
            {chat?.type === 'DIRECT' && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  setShowKebabMenu(false)
                  Alert.alert('Block Contact', 'Block this contact? They will no longer be able to send you messages.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Block',
                      style: 'destructive',
                      onPress: async () => {
                        try { await api.post(`/api/chats/${chatId}/block`) } catch {}
                      },
                    },
                  ])
                }}
              >
                <Text style={styles.contextMenuIcon}>⊘</Text>
                <Text style={styles.contextMenuText}>Block</Text>
              </TouchableOpacity>
            )}
            {/* Divider */}
            <View style={styles.kebabDivider} />
            {/* Clear chat */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                setShowKebabMenu(false)
                Alert.alert('Clear Chat', 'Clear all messages in this chat? This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      try { await api.post(`/api/chats/${chatId}/clear`) } catch {}
                    },
                  },
                ])
              }}
            >
              <Text style={[styles.contextMenuIcon, styles.contextMenuDanger]}>✕</Text>
              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>Clear chat</Text>
            </TouchableOpacity>
            {/* Delete chat */}
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => {
                setShowKebabMenu(false)
                Alert.alert('Delete Chat', 'Delete this chat? All messages will be cleared and you will leave the chat.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.delete(`/api/chats/${chatId}`)
                        navigation.goBack()
                      } catch {}
                    },
                  },
                ])
              }}
            >
              <Text style={[styles.contextMenuIcon, styles.contextMenuDanger]}>✕</Text>
              <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>Delete chat</Text>
            </TouchableOpacity>
            {/* Exit group (groups only) */}
            {chat?.type === 'GROUP' && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  setShowKebabMenu(false)
                  Alert.alert('Exit Group', 'Are you sure you want to exit this group?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Exit',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await api.post(`/api/chats/${chatId}/leave`)
                          navigation.goBack()
                        } catch {}
                      },
                    },
                  ])
                }}
              >
                <Text style={[styles.contextMenuIcon, styles.contextMenuDanger]}>→</Text>
                <Text style={[styles.contextMenuText, styles.contextMenuDanger]}>Exit group</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Convert to Task Modal */}
      <ConvertToTaskModal
        visible={showConvertModal}
        onClose={() => {
          setShowConvertModal(false)
          setSelectedMessage(null)
        }}
        message={selectedMessage ? {
          id: selectedMessage.id,
          content: selectedMessage.content || '',
          chatId: chatId,
        } : null}
        members={chat?.members || []}
        onSuccess={handleTaskConversionSuccess}
      />

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailsModal
          visible={showTaskModal}
          onClose={closeTaskModal}
          taskId={selectedTaskId}
          chatId={chatId}
          memberRole={getCurrentMemberRole()}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  // Header
  header: {
    backgroundColor: '#128C7E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '500',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  groupAvatar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    paddingLeft: 10,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
  },
  headerStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  headerTyping: {
    color: '#25D366',
    fontSize: 12,
    fontWeight: '500',
  },
  headerAction: {
    padding: 8,
  },
  headerActionIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '500',
  },
  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    padding: 4,
  },
  searchClose: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9E9E9E',
    padding: 4,
  },
  // Task filter bar
  taskFilterBar: {
    backgroundColor: '#128C7E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  taskFilterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  taskFilterClose: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  // Chat background
  chatBg: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 8,
    paddingBottom: 16,
  },
  messagesListEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  // Message rows
  messageRow: {
    marginVertical: 1,
    maxWidth: '80%',
  },
  messageRowSent: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowReceived: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
    paddingLeft: 8,
  },
  // Message bubble
  messageBubble: {
    padding: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleSent: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 0,
  },
  bubbleReceived: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
  },
  replyContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 2,
    borderLeftColor: '#128C7E',
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  replyName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#128C7E',
  },
  replyContent: {
    fontSize: 12,
    color: '#6B7280',
  },
  messageImage: {
    width: 240,
    height: 160,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#EEEEEE',
  },
  messageText: {
    fontSize: 14.5,
    color: '#212121',
    lineHeight: 19.5,
    paddingRight: 48,
  },
  // Video
  videoContainer: {
    width: 240,
    height: 160,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  videoPlayOverlay: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  videoLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  videoModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  videoModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  videoModalCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  videoPlayer: {
    width: '100%',
    height: 300,
  },
  // File indicator
  fileIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  fileIcon: {
    fontSize: 18,
    color: '#757575',
    marginRight: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#424242',
  },
  // Message meta
  msgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 2,
    paddingLeft: 8,
  },
  msgTime: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  msgCheck: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  // Voice note
  voiceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
    paddingVertical: 4,
  },
  voicePlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voicePlayIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  voiceWave: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#128C7E',
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#757575',
  },
  // Task card (in chat bubble)
  taskCard: {
    borderRadius: 10,
    overflow: 'hidden',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    backgroundColor: '#FFFFFF',
  },
  taskCardInner: {
    flexDirection: 'row',
  },
  taskCardBorder: {
    width: 5,
  },
  taskCardContent: {
    padding: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  taskCardIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  taskCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  taskCardDetail: {
    fontSize: 12,
    color: '#757575',
    marginTop: 3,
  },
  taskCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  taskStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  taskStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskChecklistMini: {
    fontSize: 12,
    color: '#757575',
  },
  // Typing indicator
  typingBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  typingText: {
    fontSize: 12,
    color: '#128C7E',
    fontStyle: 'italic',
  },
  // Upload bar
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  uploadText: {
    fontSize: 13,
    color: '#128C7E',
  },
  // Recording bar
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    gap: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
  },
  recordingCancel: {
    padding: 8,
  },
  recordingCancelText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },
  recordingStop: {
    backgroundColor: '#128C7E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingStopText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 6,
    paddingHorizontal: 8,
    gap: 6,
    backgroundColor: '#ECE5DD',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    minHeight: 44,
  },
  inputIcon: {
    padding: 4,
  },
  inputIconText: {
    fontSize: 20,
    color: '#9E9E9E',
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    padding: 4,
    paddingTop: 4,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '500',
  },
  // Context menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  contextMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '100%',
    maxWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contextMenuIcon: {
    fontSize: 18,
    color: '#757575',
    width: 24,
    textAlign: 'center',
  },
  contextMenuText: {
    fontSize: 15,
    color: '#424242',
  },
  contextMenuHighlight: {
    // highlighted variant
  },
  kebabDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  contextMenuDanger: {
    color: '#EF4444',
  },
  // Reply preview bar
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  replyPreviewContent: {
    flex: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#128C7E',
    paddingLeft: 8,
  },
  replyPreviewName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#128C7E',
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  replyPreviewClose: {
    padding: 8,
  },
  replyPreviewCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9E9E9E',
  },
})
