'use client'

import { useState } from 'react'

const NAV_LINKS = [
  { href: '/bot/admin/gebruikers', label: 'USERS' },
  { href: '/bot/admin', label: 'ARNOBOT' },
  { href: '/bot/admin/status', label: 'STATUS' },
  { href: '/bot/admin/idee', label: 'BLOGS' },
  { href: '/bot/admin/meta-analyse', label: 'META' },
  { href: '/bot/admin/emails', label: 'CRONS' },
  { href: '/bot/admin/evaluaties', label: 'FEEDBACK' },
  { href: '/bot/admin/kennisbank', label: 'KENNISBANK' },
  { href: '/bot/admin/widget', label: 'ARNO.BLOG' },

  { href: '/api/admin/logout', label: 'UITLOGGEN' },
]

export default function AdminMobileNav({ active }: { active: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="admin-mob-nav">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" />
      <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, letterSpacing: 3, color: '#f1f5f9' }}>
        ARNO<span style={{ color: '#f59e0b' }}>BOT</span>
      </span>
      <button
        className="admin-mob-hamburger"
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <div className="admin-mob-menu" onClick={() => setOpen(false)}>
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                fontSize: 28,
                letterSpacing: 3,
                color: l.href === active ? '#f59e0b' : '#9ca3af',
                textDecoration: 'none',
              }}
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
