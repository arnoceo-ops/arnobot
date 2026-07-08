import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import CoachingClient from './CoachingClient'
import BotNav from '../BotNav'
import { FlowStrip } from '@/app/bot/components/FlowStrip'

export default async function CoachingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('approved_users')
    .select('tier')
    .eq('user_id', userId)
    .single()

  if (!data || data.tier === 'basis') {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        `}</style>
        <BotNav active="coaching" />
        <div style={{ minHeight: '100vh', paddingTop: 64, background: '#111827' }}>
          <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 12 }}>COACHING</h1>
            <FlowStrip active="coaching" />
            <div style={{ borderLeft: '3px solid #f59e0b', padding: '24px 28px', background: '#1f2937', marginBottom: 40 }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
                Coaching is beschikbaar voor Pro-gebruikers. Arno analyseert al je gesprekken, je analyses uit het Archief in relatie tot jouw specifieke profiel. Hij laat je zien wat werkt en ook wat je het best kunt veranderen voor nog betere performance.
              </p>
            </div>
            <Link
              href="mailto:arno@arno.bot?subject=Upgrade%20naar%20Pro"
              style={{
                display: 'inline-block', padding: '12px 36px',
                background: '#f59e0b', color: '#111827',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18, letterSpacing: 3,
                textDecoration: 'none', borderRadius: 999,
              }}
            >
              UPGRADE NAAR PRO →
            </Link>
          </div>
        </div>
      </>
    )
  }

  return <CoachingClient userId={userId} />
}
