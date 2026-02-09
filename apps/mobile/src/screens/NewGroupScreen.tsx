import { useState, useEffect, useRef } from 'react'
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
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Contacts from 'expo-contacts'
import { api } from '../services/api'

interface User {
  id: string
  name: string
  phone: string
  avatarUrl?: string | null
}

interface PhoneContact {
  id: string
  name: string
  phone: string
}

export default function NewGroupScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const searchTimeout = useRef<NodeJS.Timeout>()
  const [step, setStep] = useState<'select' | 'name'>('select')
  const [groupName, setGroupName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [contactsPermission, setContactsPermission] = useState<boolean | null>(null)
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([])

  // Request contacts permission and load contacts
  useEffect(() => {
    requestContactsPermission()
    loadRecentUsers()
  }, [])

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync()
      setContactsPermission(status === 'granted')
      if (status === 'granted') {
        loadPhoneContacts()
      }
    } catch (err) {
      console.error('Error requesting contacts permission:', err)
      setContactsPermission(false)
    }
  }

  const loadPhoneContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      })

      const contacts: PhoneContact[] = []
      data.forEach((contact) => {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          contact.phoneNumbers.forEach((phoneNumber) => {
            if (phoneNumber.number) {
              contacts.push({
                id: `${contact.id}-${phoneNumber.number}`,
                name: contact.name || 'Unknown',
                phone: phoneNumber.number.replace(/[\s-()]/g, ''),
              })
            }
          })
        }
      })

      setPhoneContacts(contacts)

      // Match contacts with WorkChat users
      matchContactsWithUsers(contacts)
    } catch (err) {
      console.error('Error loading contacts:', err)
    }
  }

  const matchContactsWithUsers = async (contacts: PhoneContact[]) => {
    if (contacts.length === 0) return

    try {
      // Get unique phone numbers
      const phones = [...new Set(contacts.map((c) => c.phone))]

      // Search for users matching these phone numbers
      const response = await api.post('/api/users/match-contacts', {
        phones,
      })

      if (response.data.data?.length > 0) {
        // Add matched users to the users list
        setUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u.id))
          const newUsers = response.data.data.filter((u: User) => !existingIds.has(u.id))
          return [...prev, ...newUsers]
        })
      }
    } catch (err) {
      console.error('Error matching contacts:', err)
      // Silently fail - contact matching is a nice-to-have
    }
  }

  const loadRecentUsers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/users')
      setUsers(response.data.data || [])
    } catch (err) {
      console.error('Error loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      loadRecentUsers()
      return
    }

    setSearching(true)
    setError('')

    try {
      const response = await api.get('/api/users', {
        params: { query: query.trim() },
      })
      setUsers(response.data.data || [])
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.response?.data?.error?.message || 'Failed to search')
    } finally {
      setSearching(false)
    }
  }

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.id === user.id)
      if (isSelected) {
        return prev.filter((u) => u.id !== user.id)
      } else {
        return [...prev, user]
      }
    })
  }

  const proceedToName = () => {
    if (selectedUsers.length < 1) {
      Alert.alert('Select Members', 'Please select at least one member for the group')
      return
    }
    setStep('name')
  }

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name', 'Please enter a name for the group')
      return
    }

    setCreating(true)
    setError('')

    try {
      const response = await api.post('/api/chats', {
        type: 'GROUP',
        name: groupName.trim(),
        memberIds: selectedUsers.map((u) => u.id),
      })

      const chat = response.data.data
      ;(navigation as any).replace('Chat', {
        chatId: chat.id,
        chatName: chat.name,
      })
    } catch (err: any) {
      console.error('Create group error:', err)
      setError(err.response?.data?.error?.message || 'Failed to create group')
      setCreating(false)
    }
  }

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.some((u) => u.id === item.id)

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item)}
      >
        <View style={[styles.userAvatar, isSelected && styles.userAvatarSelected]}>
          <Text style={styles.userAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userPhone}>{item.phone}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    )
  }

  const renderSelectedChip = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.selectedChip}
      onPress={() => toggleUserSelection(item)}
    >
      <View style={styles.selectedChipAvatar}>
        <Text style={styles.selectedChipAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.selectedChipName} numberOfLines={1}>
        {item.name.split(' ')[0]}
      </Text>
      <Text style={styles.selectedChipRemove}>✕</Text>
    </TouchableOpacity>
  )

  if (step === 'name') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setStep('select')} style={styles.backButton}>
            <Text style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity
            onPress={createGroup}
            style={styles.nextButton}
            disabled={creating || !groupName.trim()}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.nextText, !groupName.trim() && styles.nextTextDisabled]}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.nameContainer}>
          <View style={styles.groupIconLarge}>
            <Text style={styles.groupIconLargeText}>👥</Text>
          </View>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Group name"
            placeholderTextColor="#9CA3AF"
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
            maxLength={50}
          />
          <Text style={styles.memberCount}>
            {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected
          </Text>

          {/* Selected Members Preview */}
          <View style={styles.selectedMembersPreview}>
            {selectedUsers.slice(0, 5).map((user) => (
              <View key={user.id} style={styles.memberPreviewAvatar}>
                <Text style={styles.memberPreviewText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            ))}
            {selectedUsers.length > 5 && (
              <View style={[styles.memberPreviewAvatar, styles.memberPreviewMore]}>
                <Text style={styles.memberPreviewMoreText}>+{selectedUsers.length - 5}</Text>
              </View>
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Add Members</Text>
          <Text style={styles.headerSubtitle}>
            {selectedUsers.length > 0
              ? `${selectedUsers.length} selected`
              : 'Select at least 1 member'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={proceedToName}
          style={styles.nextButton}
          disabled={selectedUsers.length < 1}
        >
          <Text style={[styles.nextText, selectedUsers.length < 1 && styles.nextTextDisabled]}>
            Next
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected Users Chips */}
      {selectedUsers.length > 0 && (
        <FlatList
          horizontal
          data={selectedUsers}
          renderItem={renderSelectedChip}
          keyExtractor={(item) => item.id}
          style={styles.selectedList}
          contentContainerStyle={styles.selectedListContent}
          showsHorizontalScrollIndicator={false}
        />
      )}

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
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('')
                loadRecentUsers()
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {(loading || searching) && (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="small" color="#128C7E" />
          <Text style={styles.searchingText}>
            {loading ? 'Loading users...' : 'Searching...'}
          </Text>
        </View>
      )}

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && !searching ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySubtitle}>
                Try searching with a different phone number or name
              </Text>
            </View>
          ) : null
        }
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
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    width: 50,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  nextButton: {
    padding: 8,
    width: 60,
    alignItems: 'flex-end',
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextTextDisabled: {
    opacity: 0.5,
  },
  selectedList: {
    maxHeight: 90,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectedListContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedChipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  selectedChipAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedChipName: {
    fontSize: 14,
    color: '#111827',
    maxWidth: 80,
  },
  selectedChipRemove: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  userItemSelected: {
    backgroundColor: '#F0FDF4',
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
  userAvatarSelected: {
    backgroundColor: '#25D366',
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
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
  nameContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  groupIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  groupIconLargeText: {
    fontSize: 48,
  },
  groupNameInput: {
    width: '100%',
    fontSize: 20,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#128C7E',
    color: '#111827',
    marginBottom: 16,
  },
  memberCount: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 16,
  },
  selectedMembersPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  memberPreviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberPreviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberPreviewMore: {
    backgroundColor: '#6B7280',
  },
  memberPreviewMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
