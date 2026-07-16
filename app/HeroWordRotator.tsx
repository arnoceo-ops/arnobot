'use client'

import { useEffect, useState } from 'react'

const WORDS = ['je klant', 'je beste gesprek', 'je vakmanschap', 'de handtekening']

export default function HeroWordRotator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % WORDS.length), 2400)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="hero-word-rotator-wrap">
      <span key={index} className="hero-word-rotator">{WORDS[index]}.</span>
    </span>
  )
}
