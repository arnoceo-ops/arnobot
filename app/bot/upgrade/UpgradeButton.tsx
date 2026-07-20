'use client'

export default function UpgradeButton({ href, label, eventName }: { href: string; label: string; eventName: string }) {
  return (
    <a
      href={href}
      onClick={() => {
        fetch('/api/bot/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventName }),
        }).catch(() => {})
      }}
      style={{
        display: 'inline-block', padding: '12px 36px',
        background: '#f59e0b', color: '#111827',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 18, letterSpacing: 3,
        textDecoration: 'none', borderRadius: 999,
        minWidth: 260, textAlign: 'center',
      }}
    >
      {label}
    </a>
  )
}
