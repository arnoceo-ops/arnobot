'use client'

import { useState } from 'react'

// Zelfde items en volgorde als AdminNav.tsx (dat heeft een eigen lijst: aparte nav-implementatie,
// altijd samen bijwerken). TEAMS ontbrak hier.
const NAV_LINKS: { href: string; label: string; ook?: string[] }[] = [
  { href: '/bot/admin/gebruikers', label: 'USERS' },
  { href: '/bot/admin/teams', label: 'TEAMS' },
  { href: '/bot/admin', label: 'GESPREKKEN' },
  { href: '/bot/admin/analyse', label: 'ANALYSE' },
  { href: '/bot/admin/status', label: 'STATUS' },
  { href: '/bot/admin/meta-analyse', label: 'META' },
  { href: '/bot/admin/emails', label: 'MAILS' },
  { href: '/bot/admin/kennisbank', label: 'KENNISBANK' },
  { href: '/bot/admin/blog', label: 'BLOG', ook: ['/bot/admin/idee'] },
  { href: '/bot/admin/stats', label: 'STATS' },

  { href: '/api/admin/logout', label: 'UITLOGGEN' },
]

export default function AdminMobileNav({ active }: { active: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="admin-mob-nav">
      <span style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: 3, color: '#f1f5f9' }}>
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
                fontFamily: 'sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 3,
                color: l.href === active || l.ook?.includes(active) ? '#f59e0b' : '#9ca3af',
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
