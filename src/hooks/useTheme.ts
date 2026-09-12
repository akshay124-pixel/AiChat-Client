import { useCallback, useEffect, useState } from 'react'
import type { Theme } from '@/types'

const STORAGE_KEY = 'ai-chat-theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Remove both, then add the correct one — keeps them mutually exclusive
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark'
  })

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
