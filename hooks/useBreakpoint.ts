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

// Telefoon of kleine tablet: aanraakscherm (pointer: coarse) ÉN een smal scherm (onder maxBreedte).
// Alleen pointer: coarse is te grof: een touchscreen-laptop (2-in-1, Edge op Windows) meldt zich ook
// als coarse pointer en kreeg daardoor de mobiele app (andere SLUIT-flow, lay-out, toetsenbord).
// Een tablet in landscape (1024 px of breder) telt als desktop.
export function useIsTouch(maxBreedte = 1024) {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const check = () => setIsTouch(mq.matches && window.innerWidth < maxBreedte)
    check()
    mq.addEventListener('change', check)
    window.addEventListener('resize', check)
    return () => {
      mq.removeEventListener('change', check)
      window.removeEventListener('resize', check)
    }
  }, [maxBreedte])

  return isTouch
}
