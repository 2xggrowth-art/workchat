import { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../services/api'

interface User {
  id: string
  name: string
  phone: string
  avatarUrl?: string | null
}

export default function NewChatScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const [searchQuery, setSearchQuery] = useState('')
  const searchTimeout = useRef<NodeJS.Timeout>()
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setNotFound(false)
      return
    }

    setSearching(true)
    setError('')
    setNotFound(false)

    try {
      // Try to search by phone first if it looks like a phone number
      const isPhoneNumber = /^[\d+\s-]+$/.test(query.trim())

      if (isPhoneNumber) {
        // Clean the phone number - remove spaces and dashes
        const cleanPhone = query.replace(/[\s-]/g, '')

        // Try exact phone search first
        const phoneResponse = await api.get('/api/users/search-phone', {
          params: { phone: cleanPhone },
        })

        if (phoneResponse.data.data) {
          setSearchResults([phoneResponse.data.data])
          setNotFound(false)
        } else {
          // If exact phone search fails, try general search (which also searches phone)
          const generalResponse = await api.get('/api/users', {
            params: { query: cleanPhone },
          })

          if (generalResponse.data.data?.length > 0) {
            setSearchResults(generalResponse.data.data)
            setNotFound(false)
          } else {
            setSearchResults([])
            // Check if user searched for their own number
            const message = phoneResponse.data.message
            if (message === 'This is your own number') {
              setError("You can't start a chat with yourself")
              setNotFound(false)
            } else {
              setNotFound(true)
            }
          }
        }
      } else {
        // Search by name
        const response = await api.get('/api/users', {
          params: { query: query.trim() },
        })
        setSearchResults(response.data.data || [])
        setNotFound(response.data.data?.length === 0)
      }
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.response?.data?.error?.message || 'Failed to search')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const startChat = async (user: User) => {
    setLoading(true)
    setError('')

    try {
      const response = await api.post('/api/users/start-chat', {
        userId: user.id,
      })

      const chat = response.data.data
      // Navigate to the chat screen
      ;(navigation as any).replace('Chat', {
        chatId: chat.id,
        chatName: user.name,
      })
    } catch (err: any) {
      console.error('Start chat error:', err)
      setError(err.response?.data?.error?.message || 'Failed to start chat')
      setLoading(false)
    }
  }

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => startChat(item)}
      disabled={loading}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userPhone}>{item.phone}</Text>
      </View>
      {loading && (
        <ActivityIndicator size="small" color="#128C7E" />
      )}
    </TouchableOpacity>
  )

  const renderEmpty = () => {
    if (searching) return null

    if (notFound) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No user found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching with a different phone number or name
          </Text>
        </View>
      )
    }

    if (!searchQuery) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyTitle}>Search for users</Text>
          <Text style={styles.emptySubtitle}>
            Enter a phone number or name to find people in WorkChat
          </Text>
        </View>
      )
    }

    return null
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Select Contact</Text>
          {searchResults.length > 0 && (
            <Text style={styles.headerSubtitle}>{searchResults.length} contacts</Text>
          )}
        </View>
      </View>

      {/* New Group Option */}
      <TouchableOpacity
        style={styles.newGroupOption}
        onPress={() => (navigation as any).navigate('NewGroup')}
      >
        <View style={styles.newGroupIcon}>
          <Text style={styles.newGroupIconText}>👥</Text>
        </View>
        <View style={styles.newGroupInfo}>
          <Text style={styles.newGroupTitle}>New Group</Text>
          <Text style={styles.newGroupSubtitle}>Create a group with multiple people</Text>
        </View>
        <Text style={styles.newGroupArrow}>›</Text>
      </TouchableOpacity>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by phone or name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text)
              clearTimeout(searchTimeout.current)
              searchTimeout.current = setTimeout(() => searchUsers(text), 300)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('')
                setSearchResults([])
                setNotFound(false)
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Loading Indicator */}
      {searching && (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="small" color="#128C7E" />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={searchResults}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          searchResults.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#128C7E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '500',
  },
  headerInfo: {
    flex: 1,
    paddingLeft: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  searchContainer: {
    padding: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    paddingBottom: 20,
  },
  listContentEmpty: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  newGroupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  newGroupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  newGroupIconText: {
    fontSize: 24,
  },
  newGroupInfo: {
    flex: 1,
  },
  newGroupTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  newGroupSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  newGroupArrow: {
    fontSize: 24,
    color: '#9CA3AF',
  },
})
