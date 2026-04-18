import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'default', visible: false })

  const show = useCallback((message, type = 'default') => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2800)
  }, [])

  return { toast, show }
}
