import { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, Text, ActivityIndicator, StyleSheet, AppState } from 'react-native'

import LoginScreen from './src/screens/LoginScreen'
import ChatListScreen from './src/screens/ChatListScreen'
import ChatScreen from './src/screens/ChatScreen'
import TasksScreen from './src/screens/TasksScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import NewChatScreen from './src/screens/NewChatScreen'
import NewGroupScreen from './src/screens/NewGroupScreen'
import AdminSummaryScreen from './src/screens/AdminSummaryScreen'
import MembersScreen from './src/screens/MembersScreen'
import GroupInfoScreen from './src/screens/GroupInfoScreen'
import ContactInfoScreen from './src/screens/ContactInfoScreen'
import Header from './src/components/ui/Header'
import { useAuthStore } from './src/stores/authStore'
import { useChatStore } from './src/stores/chatStore'
import { notificationService } from './src/services/notifications'
import { socketService } from './src/services/socket'
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const queryClient = new QueryClient()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const { colors } = useTheme()
  const labels: Record<string, string> = {
    Chats: 'C',
    Tasks: 'T',
    Profile: 'P',
  }
  return (
    <View
      style={{
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: focused ? '700' : '400',
          color: focused ? colors.primary : colors.textMuted,
        }}
      >
        {labels[name]}
      </Text>
    </View>
  )
}

function ScreenWithHeader({ children, title }: { children: React.ReactNode; title?: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={title} />
      {children}
    </View>
  )
}

function ChatsTab() {
  return (
    <ScreenWithHeader>
      <ChatListScreen />
    </ScreenWithHeader>
  )
}

function TasksTab() {
  return (
    <ScreenWithHeader title="Tasks">
      <TasksScreen />
    </ScreenWithHeader>
  )
}

function ProfileTab() {
  return <ProfileScreen />
}

function MainTabs() {
  const { colors } = useTheme()
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }: { focused: boolean }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 56,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Chats" component={ChatsTab} />
      <Tab.Screen name="Tasks" component={TasksTab} />
      <Tab.Screen name="Profile" component={ProfileTab} />
    </Tab.Navigator>
  )
}

function RootNavigator() {
  const { user, isInitialized, initialize } = useAuthStore()
  const currentChatId = useChatStore((state) => state.currentChatId)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    initialize()
    notificationService.initialize()

    const responseSubscription = notificationService.addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data
        if (data?.chatId) {
          console.log('[App] Notification tapped, chatId:', data.chatId)
        }
      }
    )

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState
    })

    return () => {
      responseSubscription.remove()
      appStateSubscription.remove()
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const unsubscribeNewMessage = socketService.on('new_message', async (data: any) => {
      const isBackground = appState.current !== 'active'
      const isCurrentChat = currentChatId === data.chatId
      const isOwnMessage = data.message?.senderId === user.id

      if (!isOwnMessage && (isBackground || !isCurrentChat)) {
        const senderName = data.message?.sender?.name || 'Someone'
        const content = data.message?.content || 'Sent a message'

        await notificationService.showLocalNotification({
          title: senderName,
          body: content.length > 50 ? content.substring(0, 50) + '...' : content,
          data: { chatId: data.chatId },
        })
      }
    })

    return () => {
      unsubscribeNewMessage()
    }
  }, [user?.id, currentChatId])

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.splashLogo}>
          <Text style={styles.splashLogoText}>W</Text>
        </View>
        <Text style={styles.splashTitle}>WorkChat</Text>
        <Text style={styles.splashSubtitle}>A Work WhatsApp with enforced execution</Text>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 48 }} />
      </View>
    )
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="NewChat" component={NewChatScreen} />
          <Stack.Screen name="NewGroup" component={NewGroupScreen} />
          <Stack.Screen name="AdminSummary" component={AdminSummaryScreen} />
          <Stack.Screen name="Members" component={MembersScreen} />
          <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
          <Stack.Screen name="ContactInfo" component={ContactInfoScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="light" />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#075E54',
  },
  splashLogo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  splashLogoText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  splashSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})
