'use client'

import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const TESTIMONIALS = [
  {
    quote:
      'Na drie maanden met ArnoBot sloot ik 40% meer deals. De dagelijkse feedback op mijn gesprekken heeft mijn aanpak compleet veranderd.',
    name: 'Sanne de Vries',
    role: 'Account Executive, SaaS-scale-up',
  },
  {
    quote:
      'Ons hele team gebruikt ArnoBot. De pipeline-inzichten alleen al zijn goud waard, we weten nu precies waar we onze tijd in moeten steken.',
    name: 'Mark Janssen',
    role: 'Sales Director, IT-dienstverlener',
  },
  {
    quote:
      'Het voelt echt als een persoonlijke coach die altijd voor je klaarstaat. Mijn pitch is scherper dan ooit en dat zie ik terug in mijn cijfers.',
    name: 'Lisa Bakker',
    role: 'Business Development Manager',
  },
]

export default function HomeTestimonialCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setActive(i => (i + 1) % TESTIMONIALS.length), [])
  const prev = useCallback(() => setActive(i => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length), [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [paused, next])

  return (
    <div
      className="htc-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="htc-header">
        <div>
          <p className="testimonial-label">Klantverhalen</p>
          <h2 className="testimonial-heading">Wat gebruikers zeggen</h2>
        </div>
        <div className="htc-nav">
          <button type="button" onClick={prev} aria-label="Vorige testimonial" className="htc-nav-btn">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={next} aria-label="Volgende testimonial" className="htc-nav-btn">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="htc-grid">
        {TESTIMONIALS.map((t, i) => (
          <figure key={t.name} className={`htc-card ${i === active ? 'htc-card-active' : 'htc-card-inactive'}`}>
            <Quote size={28} color="#f59e0b" aria-hidden="true" />
            <blockquote className="htc-quote">{t.quote}</blockquote>
            <figcaption>
              <p className="htc-name">{t.name}</p>
              <p className="htc-role">{t.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="htc-dots" role="tablist" aria-label="Testimonials">
        {TESTIMONIALS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Testimonial van ${t.name}`}
            onClick={() => setActive(i)}
            className={`htc-dot ${i === active ? 'htc-dot-active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
