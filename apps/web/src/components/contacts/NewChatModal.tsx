import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

interface User {
  id: string
  phone: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
}

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
  </svg>
)

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)

const GroupIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
)

export default function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'search' | 'group'>('search')

  // Group creation state
  const [groupName, setGroupName] = useState('')
  const [groupSearchQuery, setGroupSearchQuery] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<User[]>([])

  // Search users query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []
      const response = await api.get('/api/users', { params: { query: searchQuery } })
      return response.data.data as User[]
    },
    enabled: searchQuery.length >= 2,
  })

  // Search by phone number query
  const { data: phoneResult, isLoading: isPhoneSearching } = useQuery({
    queryKey: ['phone-search', searchQuery],
    queryFn: async () => {
      // Only search by phone if query looks like a phone number
      const cleaned = searchQuery.replace(/\s+/g, '')
      if (!/^\+?\d{10,15}$/.test(cleaned)) return null
      const response = await api.get('/api/users/search-phone', { params: { phone: cleaned } })
      return response.data.data as User | null
    },
    enabled: searchQuery.length >= 10,
  })

  // Search users for group query
  const { data: groupSearchResults, isLoading: isGroupSearching } = useQuery({
    queryKey: ['user-search-group', groupSearchQuery],
    queryFn: async () => {
      if (!groupSearchQuery || groupSearchQuery.length < 2) return []
      const response = await api.get('/api/users', { params: { query: groupSearchQuery } })
      return response.data.data as User[]
    },
    enabled: groupSearchQuery.length >= 2 && activeTab === 'group',
  })

  // Start chat mutation
  const startChatMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post('/api/users/start-chat', { userId })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      navigate(`/chat/${data.data.id}`)
      onClose()
    },
  })

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; memberIds: string[] }) => {
      const response = await api.post('/api/chats', {
        type: 'GROUP',
        name: data.name,
        memberIds: data.memberIds,
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      navigate(`/chat/${data.data.id}`)
      resetGroupForm()
      onClose()
    },
  })

  // Combine results: phone match first, then search results (excluding phone match)
  const users = (() => {
    const results: User[] = []
    if (phoneResult) {
      results.push(phoneResult)
    }
    if (searchResults) {
      searchResults.forEach((user) => {
        if (!phoneResult || user.id !== phoneResult.id) {
          results.push(user)
        }
      })
    }
    return results
  })()

  const handleStartChat = (userId: string) => {
    startChatMutation.mutate(userId)
  }

  const handleAddMember = (user: User) => {
    if (!selectedMembers.find((m) => m.id === user.id)) {
      setSelectedMembers([...selectedMembers, user])
    }
    setGroupSearchQuery('')
  }

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== userId))
  }

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedMembers.length === 0) return
    createGroupMutation.mutate({
      name: groupName.trim(),
      memberIds: selectedMembers.map((m) => m.id),
    })
  }

  const resetGroupForm = () => {
    setGroupName('')
    setGroupSearchQuery('')
    setSelectedMembers([])
  }

  // Filter out already selected members from search results
  const availableGroupUsers = (groupSearchResults || []).filter(
    (user) => !selectedMembers.find((m) => m.id === user.id)
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#111B21] rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#075E54] dark:bg-[#202C33] px-4 py-4 flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
          <h2 className="text-white text-lg font-medium">New chat</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-[#222D34]">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-[#075E54] dark:text-[#00A884] border-b-2 border-[#075E54] dark:border-[#00A884]'
                : 'text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-[#E9EDEF]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <PersonIcon />
              <span>Find Contact</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'group'
                ? 'text-[#075E54] dark:text-[#00A884] border-b-2 border-[#075E54] dark:border-[#00A884]'
                : 'text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-[#E9EDEF]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <GroupIcon />
              <span>New Group</span>
            </div>
          </button>
        </div>

        {activeTab === 'search' ? (
          <>
            {/* Search input */}
            <div className="p-4 bg-white dark:bg-[#111B21]">
              <div className="flex items-center gap-3 bg-[#f0f2f5] dark:bg-[#202C33] rounded-lg px-4 py-2">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search name or phone number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] outline-none text-sm"
                  autoFocus
                />
              </div>
              <p className="text-gray-400 dark:text-[#8696A0] text-xs mt-2 px-1">
                Enter phone number with country code (e.g., +1234567890)
              </p>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto">
              {(isSearching || isPhoneSearching) && searchQuery.length >= 2 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-[#128C7E] dark:border-[#00A884] border-t-transparent rounded-full" />
                </div>
              ) : users.length === 0 && searchQuery.length >= 2 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-[#8696A0] px-8 text-center">
                  <PersonIcon />
                  <p className="text-sm mt-3">No users found</p>
                  <p className="text-xs mt-1 opacity-75">
                    Make sure the phone number is registered on WorkChat
                  </p>
                </div>
              ) : searchQuery.length < 2 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-[#8696A0] px-8 text-center">
                  <SearchIcon />
                  <p className="text-sm mt-3">Search for contacts</p>
                  <p className="text-xs mt-1 opacity-75">
                    Type a name or phone number to find users
                  </p>
                </div>
              ) : (
                users.map((user) => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    onClick={() => handleStartChat(user.id)}
                    isLoading={startChatMutation.isPending}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          /* Group creation */
          <div className="flex flex-col">
            {/* Group name input */}
            <div className="p-4 bg-white dark:bg-[#111B21] border-b border-gray-200 dark:border-[#222D34]">
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-[#f0f2f5] dark:bg-[#202C33] text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg px-4 py-2.5 outline-none text-sm focus:ring-1 focus:ring-[#128C7E] dark:focus:ring-[#00A884]"
                autoFocus
              />
            </div>

            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="p-3 bg-white dark:bg-[#111B21] border-b border-gray-200 dark:border-[#222D34]">
                <p className="text-xs text-gray-400 dark:text-[#8696A0] mb-2">
                  {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202C33] rounded-full px-3 py-1.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#6B7C85] flex items-center justify-center text-white text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-900 dark:text-[#E9EDEF]">{member.name}</span>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-gray-400 dark:text-[#8696A0] hover:text-gray-600 dark:hover:text-white"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search members */}
            <div className="p-4 bg-white dark:bg-[#111B21]">
              <div className="flex items-center gap-3 bg-[#f0f2f5] dark:bg-[#202C33] rounded-lg px-4 py-2">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Add members..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] outline-none text-sm"
                />
              </div>
            </div>

            {/* Search results */}
            <div className="max-h-[250px] overflow-y-auto">
              {isGroupSearching ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-[#128C7E] dark:border-[#00A884] border-t-transparent rounded-full" />
                </div>
              ) : groupSearchQuery.length >= 2 && availableGroupUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-[#8696A0] px-8 text-center">
                  <p className="text-sm">No users found</p>
                </div>
              ) : groupSearchQuery.length < 2 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-[#8696A0] px-8 text-center">
                  <p className="text-sm">Search to add members</p>
                </div>
              ) : (
                availableGroupUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAddMember(user)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f0f2f5] dark:hover:bg-[#202C33] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#6B7C85] flex items-center justify-center text-white font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-[#E9EDEF] text-sm truncate">{user.name}</h3>
                      <p className="text-xs text-gray-400 dark:text-[#8696A0] truncate">{user.phone}</p>
                    </div>
                    <div className="text-[#128C7E] dark:text-[#00A884]">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Create button */}
            <div className="p-4 bg-white dark:bg-[#111B21] border-t border-gray-200 dark:border-[#222D34]">
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMembers.length === 0 || createGroupMutation.isPending}
                className="w-full bg-[#25D366] text-white font-semibold py-2.5 rounded-lg hover:bg-[#1da851] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createGroupMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  <>
                    <GroupIcon />
                    Create Group
                  </>
                )}
              </button>
              {selectedMembers.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-[#8696A0] text-center mt-2">
                  Add at least one member to create a group
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface UserListItemProps {
  user: User
  onClick: () => void
  isLoading: boolean
}

function UserListItem({ user, onClick, isLoading }: UserListItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0f2f5] dark:hover:bg-[#202C33] transition-colors text-left disabled:opacity-50"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-[#6B7C85] flex items-center justify-center text-white font-medium text-lg flex-shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          user.name.charAt(0).toUpperCase()
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-[#E9EDEF] truncate">{user.name}</h3>
        <p className="text-sm text-gray-400 dark:text-[#8696A0] truncate">{user.phone}</p>
      </div>

      {/* Chat indicator */}
      <div className="text-[#128C7E] dark:text-[#00A884]">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
    </button>
  )
}
