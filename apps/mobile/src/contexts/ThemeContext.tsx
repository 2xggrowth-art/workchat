import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeColors {
  background: string
  surface: string
  surfaceSecondary: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  headerBg: string
  headerText: string
  chatBg: string
  bubbleSent: string
  bubbleReceived: string
  inputBg: string
  primary: string
  primaryDark: string
  accent: string
}

interface ThemeContextType {
  mode: ThemeMode
  isDark: boolean
  colors: ThemeColors
  setMode: (mode: ThemeMode) => void
}

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F5',
  text: '#212121',
  textSecondary: '#424242',
  textMuted: '#9E9E9E',
  border: '#EEEEEE',
  headerBg: '#128C7E',
  headerText: '#FFFFFF',
  chatBg: '#ECE5DD',
  bubbleSent: '#DCF8C6',
  bubbleReceived: '#FFFFFF',
  inputBg: '#FFFFFF',
  primary: '#128C7E',
  primaryDark: '#075E54',
  accent: '#25D366',
}

const darkColors: ThemeColors = {
  background: '#111B21',
  surface: '#1F2C34',
  surfaceSecondary: '#0B141A',
  text: '#E9EDEF',
  textSecondary: '#8696A0',
  textMuted: '#667781',
  border: '#233138',
  headerBg: '#1F2C34',
  headerText: '#E9EDEF',
  chatBg: '#0B141A',
  bubbleSent: '#005C4B',
  bubbleReceived: '#1F2C34',
  inputBg: '#1F2C34',
  primary: '#00A884',
  primaryDark: '#1F2C34',
  accent: '#00A884',
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  isDark: false,
  colors: lightColors,
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('light')

  useEffect(() => {
    AsyncStorage.getItem('workchat-theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved)
      }
    })
  }, [])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    AsyncStorage.setItem('workchat-theme', newMode)
  }

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark')
  const colors = isDark ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
