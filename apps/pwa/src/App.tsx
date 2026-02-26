import { useState, useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { initSocket } from './services/socket'
import TabBar from './components/TabBar'
import InstallPrompt from './components/InstallPrompt'
import LoginScreen from './screens/LoginScreen'
import ChatListScreen from './screens/ChatListScreen'
import ChatScreen from './screens/ChatScreen'
import TasksScreen from './screens/TasksScreen'
import SettingsScreen from './screens/SettingsScreen'
import TaskDetailSheet from './screens/TaskDetailSheet'
import ConvertToTaskSheet from './screens/ConvertToTaskSheet'
import NewChatScreen from './screens/NewChatScreen'
import NewGroupScreen from './screens/NewGroupScreen'
import GroupInfoScreen from './screens/GroupInfoScreen'
import ContactInfoScreen from './screens/ContactInfoScreen'
import ApproveUsersScreen from './screens/ApproveUsersScreen'
import ProfileScreen from './screens/ProfileScreen'
import MembersScreen from './screens/MembersScreen'
import AdminSummarySheet from './screens/AdminSummarySheet'
import { Chat } from './types'

type Screen = 'main' | 'chat' | 'newChat' | 'newGroup' | 'groupInfo' | 'contactInfo' | 'approveUsers' | 'profile' | 'members'

export default function App() {
  const { user, token } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const [activeTab, setActiveTab] = useState('chats')
  const [screen, setScreen] = useState<Screen>('main')
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null)
  const [convertTask, setConvertTask] = useState<{ messageId: string; text: string } | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  // Reconnect socket on app load if logged in
  useEffect(() => {
    if (token) initSocket(token)
  }, [token])

  // Not logged in
  if (!user || !token) {
    return <LoginScreen />
  }

  const handleOpenChat = (chat: Chat) => {
    setCurrentChat(chat)
    setScreen('chat')
  }

  const handleBackFromChat = () => {
    setScreen('main')
    setCurrentChat(null)
  }

  const handleConvertToTask = (messageId: string, messageText: string) => {
    setConvertTask({ messageId, text: messageText })
  }

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-[#1a1a1a] relative overflow-hidden">
      <InstallPrompt />

      {/* Main tab content */}
      <div className="flex-1 relative overflow-hidden">
        <div className={activeTab === 'chats' ? 'h-full' : 'hidden'}>
          <ChatListScreen
            onOpenChat={handleOpenChat}
            onNewChat={() => setScreen('newChat')}
          />
        </div>
        <div className={activeTab === 'tasks' ? 'h-full' : 'hidden'}>
          <TasksScreen onTaskDetail={setTaskDetailId} />
        </div>
        <div className={activeTab === 'settings' ? 'h-full' : 'hidden'}>
          <SettingsScreen
            onApproveUsers={() => setScreen('approveUsers')}
            onProfile={() => setScreen('profile')}
            onManageMembers={() => setScreen('members')}
          />
        </div>
      </div>

      {/* Tab bar */}
      {screen === 'main' && (
        <TabBar active={activeTab} onTabChange={setActiveTab} onSummary={isAdmin ? () => setShowSummary(true) : undefined} />
      )}

      {/* Chat screen overlay */}
      {screen === 'chat' && currentChat && (
        <ChatScreen
          chat={currentChat}
          onBack={handleBackFromChat}
          onTaskDetail={setTaskDetailId}
          onGroupInfo={() => setScreen('groupInfo')}
          onContactInfo={() => setScreen('contactInfo')}
          onConvertToTask={handleConvertToTask}
        />
      )}

      {/* New Chat screen */}
      {screen === 'newChat' && (
        <NewChatScreen
          onBack={() => setScreen('main')}
          onOpenChat={(chat) => { handleOpenChat(chat); }}
          onNewGroup={() => setScreen('newGroup')}
        />
      )}

      {/* New Group screen */}
      {screen === 'newGroup' && (
        <NewGroupScreen
          onBack={() => setScreen('newChat')}
          onOpenChat={(chat) => { handleOpenChat(chat); }}
        />
      )}

      {/* Group Info screen */}
      {screen === 'groupInfo' && currentChat && (
        <GroupInfoScreen
          chat={currentChat}
          onBack={() => setScreen('chat')}
          onExitGroup={() => { setScreen('main'); setCurrentChat(null) }}
        />
      )}

      {/* Contact Info screen */}
      {screen === 'contactInfo' && currentChat && (
        <ContactInfoScreen
          chat={currentChat}
          onBack={() => setScreen('chat')}
        />
      )}

      {/* Approve Users screen */}
      {screen === 'approveUsers' && (
        <ApproveUsersScreen onBack={() => setScreen('main')} />
      )}

      {/* Profile screen */}
      {screen === 'profile' && (
        <ProfileScreen onBack={() => setScreen('main')} />
      )}

      {/* Members screen */}
      {screen === 'members' && (
        <MembersScreen onBack={() => setScreen('main')} />
      )}

      {/* Task Detail sheet */}
      <TaskDetailSheet
        taskId={taskDetailId}
        onClose={() => setTaskDetailId(null)}
      />

      {/* Convert to Task sheet */}
      {convertTask && currentChat && (
        <ConvertToTaskSheet
          open={!!convertTask}
          onClose={() => setConvertTask(null)}
          chatId={currentChat.id}
          messageId={convertTask.messageId}
          messageText={convertTask.text}
        />
      )}

      {/* Admin Summary sheet */}
      <AdminSummarySheet
        open={showSummary}
        onClose={() => setShowSummary(false)}
        onTaskDetail={setTaskDetailId}
      />
    </div>
  )
}
