import { useEffect, useState } from 'react'

function getViewportWidth() {
  if (typeof window === 'undefined') return 1200
  return window.innerWidth
}

function getIsCoarsePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

export function useResponsive() {
  const [width, setWidth] = useState(getViewportWidth)
  const [isCoarsePointer, setIsCoarsePointer] = useState(getIsCoarsePointer)

  useEffect(() => {
    let rafId: number | null = null

    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setWidth(getViewportWidth())
        setIsCoarsePointer(getIsCoarsePointer())
        rafId = null
      })
    }

    const pointerQuery = window.matchMedia?.('(pointer: coarse)')
    pointerQuery?.addEventListener?.('change', handleResize)
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      pointerQuery?.removeEventListener?.('change', handleResize)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  const isMobile = width <= 640 || (isCoarsePointer && width <= 900)

  return {
    width,
    isMobile,
    isTablet: width > 640 && width <= 1024,
    isCompact: width <= 1024,
    isCoarsePointer,
  }
}
