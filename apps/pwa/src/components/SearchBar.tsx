import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = 'Search' }: SearchBarProps) {
  return (
    <div className="px-4 pb-2.5">
      <div className="bg-gray-200 dark:bg-gray-700 rounded-[10px] flex items-center px-2 h-9">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent border-none outline-none text-[17px] px-1.5 w-full placeholder-gray-400 dark:text-white"
        />
      </div>
    </div>
  )
}
