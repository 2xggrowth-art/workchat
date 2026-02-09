import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useAuthStore } from '../stores/authStore'

type Mode = 'login' | 'register' | 'pending'

export default function LoginScreen() {
  const { login, register, isLoading } = useAuthStore()

  const [mode, setMode] = useState<Mode>('login')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!phone.trim() || !pin.trim()) {
      setError('Please enter phone number and pin')
      return
    }
    setError('')

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`
      await login(formattedPhone, pin)
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Login failed'
      if (msg.includes('pending approval')) {
        setMode('pending')
      } else {
        setError(msg)
      }
    }
  }

  const handleRegister = async () => {
    if (!phone.trim() || !pin.trim() || !name.trim()) {
      setError('Please fill in all fields')
      return
    }
    if (pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4-6 digits')
      return
    }
    setError('')

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`
      await register(formattedPhone, pin, name)
      setMode('pending')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Registration failed')
    }
  }

  if (mode === 'pending') {
    return (
      <View style={styles.container}>
        <View style={styles.pendingContainer}>
          <View style={styles.pendingIcon}>
            <Text style={styles.pendingIconText}>&#x23F3;</Text>
          </View>
          <Text style={styles.pendingTitle}>Account Pending</Text>
          <Text style={styles.pendingSubtitle}>
            Your registration is pending admin approval. You will be able to log in once approved.
          </Text>
          <TouchableOpacity
            style={styles.pendingButton}
            onPress={() => {
              setMode('login')
              setError('')
            }}
          >
            <Text style={styles.pendingButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.loginHeader}>
          <View style={styles.logoSm}>
            <Text style={styles.logoIcon}>W</Text>
          </View>
          <Text style={styles.headerTitle}>WorkChat</Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.loginForm}>
          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#9E9E9E"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+1234567890"
              placeholderTextColor="#9E9E9E"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter PIN (4-6 digits)"
              placeholderTextColor="#9E9E9E"
              value={pin}
              onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 6))}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>{mode === 'login' ? 'Login' : 'Register'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Login'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loginHeader: {
    backgroundColor: '#075E54',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoSm: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  loginForm: {
    padding: 32,
    paddingTop: 24,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  btn: {
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  switchMode: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
    color: '#128C7E',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    fontSize: 14,
  },
  footerText: {
    color: '#9E9E9E',
    textAlign: 'center',
    fontSize: 13,
    paddingBottom: 24,
    paddingHorizontal: 32,
  },
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#075E54',
  },
  pendingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pendingIconText: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  pendingSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  pendingButton: {
    backgroundColor: '#25D366',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  pendingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
})
