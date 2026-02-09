import { useState, useRef, useEffect, useCallback } from 'react'

interface VoiceNotePlayerProps {
  src: string
  isSent: boolean
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoiceNotePlayer({ src, isSent }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const audio = new Audio(src)
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      if (isFinite(audio.duration)) setDuration(audio.duration)
    })
    audio.addEventListener('durationchange', () => {
      if (isFinite(audio.duration)) setDuration(audio.duration)
    })
    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })

    return () => {
      cancelAnimationFrame(animRef.current)
      audio.pause()
      audio.src = ''
    }
  }, [src])

  const tick = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      cancelAnimationFrame(animRef.current)
      setIsPlaying(false)
    } else {
      audio.play()
      animRef.current = requestAnimationFrame(tick)
      setIsPlaying(true)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * duration
    setCurrentTime(audio.currentTime)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const accentColor = isSent ? '#075E54' : '#128C7E'

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] py-1">
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: accentColor }}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="h-[6px] bg-gray-300 dark:bg-[#3B4A54] rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%`, background: accentColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-gray-500 dark:text-[#8696A0]">
            {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
          </span>
        </div>
      </div>

      <svg className="w-5 h-5 text-gray-400 dark:text-[#8696A0] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
      </svg>
    </div>
  )
}
