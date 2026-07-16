'use client'

import { useEffect, useState } from 'react'

type Testimonial = { _id: string; quote: string; name: string; role?: string }

export default function TestimonialSlider({ testimonials }: { testimonials: Testimonial[] }) {
  const [start, setStart] = useState(0)

  useEffect(() => {
    if (testimonials.length <= 2) return
    const id = setInterval(() => setStart(i => (i + 1) % testimonials.length), 3500)
    return () => clearInterval(id)
  }, [testimonials.length])

  const visible = [testimonials[start], testimonials[(start + 1) % testimonials.length]]

  return (
    <div className="testimonial-grid">
      {visible.map((t, i) => (
        <div className="testimonial-card" key={`${t._id}-${i}`}>
          <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
          <p className="testimonial-name">{t.name}</p>
          {t.role && <p className="testimonial-role">{t.role}</p>}
        </div>
      ))}
    </div>
  )
}
