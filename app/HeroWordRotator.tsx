'use client'

import { useEffect, useState } from 'react'

const WORDS = ['target', 'cijfers', 'bonus', 'omzet']

export default function HeroWordRotator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % WORDS.length), 2200)
    return () => clearInterval(id)
  }, [])

  return <span className="hero-word-rotator">{WORDS[index]}</span>
}
