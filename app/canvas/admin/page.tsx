// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ALL_TOTAL = 82

type UserProfile = {
  user_id: string
  email: string
  full_name: string
  role: string
  created_at: string
  health_score?: number
}

export default function AdminPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (isLoaded && !user) { router.push('/sign-in'); return }
    if (!user) return
    fetch('/api/canvas/admin/verify')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) router.push('/canvas')
        else setIsAdmin(true)
      })
      .catch(() => router.push('/canvas'))
  }, [isLoaded, user, router])

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profiles) {
        const withScores = await Promise.all(
          profiles.map(async (profile: { user_id: string; email: string | null; full_name: string | null; role: string | null; created_at: string | null; invited_by: string | null }) => {
            const { data: answers } = await supabase
              .from('canvas_answers')
              .select('question_id, answer')
              .eq('user_id', profile.user_id)
            const filled = answers?.filter(a => a.answer?.trim()).length || 0
            const health_score = Math.round((filled / ALL_TOTAL) * 100)
            return { ...profile, health_score }
          })
        )
        setUsers(withScores)
      }
      setLoading(false)
    }
    load()
  }, [isAdmin])

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return
    setInviteStatus('Versturen...')
    try {
      await supabase.from('invites').insert({
        email: inviteEmail.trim(),
        invited_by: user.id,
      })
      const res = await fetch('/api/canvas/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      if (res.ok) {
        setInviteStatus('Uitnodiging verstuurd ✓')
        setInviteEmail('')
      } else {
        setInviteStatus('Fout bij versturen.')
      }
    } catch {
      setInviteStatus('Fout bij versturen.')
    }
    setTimeout(() => setInviteStatus(''), 3000)
  }

  if (!isLoaded || !user || !isAdmin) return null

  return (
    <main style={{ backgroundColor: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'var(--font-geist-sans), sans-serif', padding: '64px 48px' }}>
      <div style={{ marginBottom: '64px' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px', fontSize: '12px', letterSpacing: '2px' }}>
          <Link href="/canvas" style={{ color: '#f1f5f9', textDecoration: 'none', opacity: 0.4 }}>← CANVAS</Link>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: '#f59e0b' }}>ADMIN</span>
        </nav>
        <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px', marginBottom: '12px', opacity: 0.7 }}>ROYAL DUTCH SALES</p>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '80px', letterSpacing: '6px', color: '#f1f5f9', margin: '0 0 8px 0', lineHeight: 1 }}>TEAM OVERZICHT</h1>
        <p style={{ color: '#f1f5f9', opacity: 0.35, fontSize: '13px' }}>{users.length} gebruiker{users.length !== 1 ? 's' : ''} actief</p>
      </div>

      <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '40px', marginBottom: '64px' }}>
        <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '3px', marginBottom: '20px' }}>GEBRUIKER UITNODIGEN</p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} placeholder="naam@bedrijf.nl" style={{ backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #374151', color: '#f1f5f9', fontSize: '14px', padding: '8px 0', outline: 'none', width: '320px', fontFamily: 'var(--font-geist-sans), sans-serif' }} />
          <button onClick={handleInvite} style={{ backgroundColor: '#f59e0b', color: '#111827', border: 'none', padding: '10px 24px', fontSize: '11px', letterSpacing: '2px', cursor: 'pointer' }}>UITNODIGEN</button>
          {inviteStatus && <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '2px', opacity: 0.7 }}>{inviteStatus}</span>}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '3px', marginBottom: '32px' }}>GEBRUIKERS: {users.length}</p>
        {loading ? (
          <p style={{ opacity: 0.4, fontSize: '14px' }}>Laden...</p>
        ) : users.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: '14px' }}>Nog geen gebruikers. Stuur een uitnodiging.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 140px', padding: '0 24px 12px', fontSize: '10px', letterSpacing: '2px', color: '#f59e0b', opacity: 0.5 }}>
              <span>NAAM / EMAIL</span><span>ROL</span><span>LID SINDS</span><span>HEALTH SCORE</span>
            </div>
            {users.map(u => (
              <div key={u.user_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 140px', padding: '20px 24px', borderTop: '1px solid #1e293b', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '14px', marginBottom: '4px' }}>{u.full_name || 'n.v.t.'}</p>
                  <p style={{ fontSize: '12px', opacity: 0.4 }}>{u.email}</p>
                </div>
                <p style={{ fontSize: '12px', letterSpacing: '1px', opacity: 0.5, textTransform: 'uppercase' }}>{u.role}</p>
                <p style={{ fontSize: '12px', opacity: 0.4 }}>{new Date(u.created_at).toLocaleDateString('nl-NL')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#1e293b' }}>
                    <div style={{ height: '1px', width: `${u.health_score || 0}%`, backgroundColor: '#f59e0b' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#f59e0b', opacity: 0.6, minWidth: '32px' }}>{u.health_score || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
