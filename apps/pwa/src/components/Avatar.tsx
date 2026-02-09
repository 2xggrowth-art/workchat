const COLORS = ['bg-teal', 'bg-emerald-500', 'bg-sky-500', 'bg-orange-500', 'bg-purple-500', 'bg-rose-500']

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  emoji?: string | null
  size?: number
  className?: string
}

export default function Avatar({ name, avatarUrl, emoji, size = 50, className = '' }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase()
  const colorIndex = name.charCodeAt(0) % COLORS.length

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  if (emoji) {
    return (
      <div
        className={`bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {emoji}
      </div>
    )
  }

  return (
    <div
      className={`${COLORS[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}
