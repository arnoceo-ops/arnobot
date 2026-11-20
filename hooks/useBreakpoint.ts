'use client'
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}

// Detecteert touch-apparaten op invoertype, niet schermbreedte.
// pointer: coarse = vinger/stylus als primair invoerapparaat (telefoon, tablet).
export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouch(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isTouch
}

// Telefoon of kleine tablet: aanraakscherm ÉN smal scherm. Alleen pointer: coarse is te grof,
// want een touchscreen-laptop (2-in-1, Edge op Windows) meldt zich ook als coarse pointer.
export function useIsTelefoonOfTablet(maxBreedte = 1024) {
  const isTouch = useIsTouch()
  const [smal, setSmal] = useState(false)

  useEffect(() => {
    const check = () => setSmal(window.innerWidth < maxBreedte)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [maxBreedte])

  return isTouch && smal
}
