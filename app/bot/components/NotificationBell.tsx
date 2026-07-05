'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

interface Notification {
  id: string
  type: string
  member_id: string
  member_name: string
  created_at: string
  read_at: string | null
}

interface Props {
  onNavigate?: (path: string) => void
}

function tijdGeleden(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `${min}m geleden`
  const uur = Math.round(min / 60)
  if (uur < 24) return `${uur}u geleden`
  return `${Math.round(uur / 24)}d geleden`
}

function notifLabel(type: string, memberName: string) {
  if (type === 'analyse_gedeeld') return `${memberName} heeft een analyse gedeeld`
  if (type === 'coaching_gegenereerd') return `${memberName} heeft coaching gegenereerd`
  return memberName
}

const DEMO_EMAIL = 'linkedin@royaldutchsales.com'

export default function NotificationBell({ onNavigate }: Props) {
  const router = useRouter()
  const { user } = useUser()
  const isDemo = user?.primaryEmailAddress?.emailAddress === DEMO_EMAIL
  const [isManager, setIsManager] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/bot/team/status')
      .then(r => r.json())
      .then(d => {
        if (d.isManager) {
          setIsManager(true)
          fetchNotifications()
        }
      })
      .catch(() => {})
  }, [])

  function fetchNotifications() {
    fetch('/api/bot/team/notifications')
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications ?? [])
        setUnread(d.unread ?? 0)
      })
      .catch(() => {})
  }

  function toggle() {
    setOpen(o => !o)
    if (unread > 0 && !isDemo) {
      fetch('/api/bot/team/notifications/read', { method: 'PATCH' })
        .then(() => setUnread(0))
        .catch(() => {})
    }
  }

  function navigateTo(path: string) {
    setOpen(false)
    if (onNavigate) onNavigate(path)
    else router.push(path)
  }

  if (!isManager) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative', lineHeight: 1 }}
        aria-label="Notificaties"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={open ? '#f59e0b' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: '#cc2200', color: '#fff', fontFamily: "'Space Mono',monospace", fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{ position: 'absolute', top: 36, right: 0, background: '#1f2937', border: '1px solid #374151', width: 320, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #374151' }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: 4, color: '#f59e0b' }}>NOTIFICATIES</span>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 20, fontFamily: "'Space Mono',monospace", fontSize: 13, color: '#6b7280' }}>Geen notificaties</div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => navigateTo(`/bot/team/lid/${n.member_id}`)}
                    style={{ padding: '14px 20px', borderBottom: '1px solid #1a2332', cursor: 'pointer', background: (!n.read_at || isDemo) ? 'rgba(245,158,11,0.04)' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#111827')}
                    onMouseLeave={e => (e.currentTarget.style.background = (!n.read_at || isDemo) ? 'rgba(245,158,11,0.04)' : 'transparent')}
                  >
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: '#f1f5f9', lineHeight: 1.6, margin: '0 0 4px' }}>
                      {notifLabel(n.type, n.member_name)}
                    </p>
                    <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: '#6b7280', margin: 0 }}>
                      {tijdGeleden(n.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
