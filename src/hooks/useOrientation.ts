import { useState, useEffect } from 'react'

export function useIsLandscape(): boolean {
  const [landscape, setLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  )
  useEffect(() => {
    const update = () => setLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return landscape
}
