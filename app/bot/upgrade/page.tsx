import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import BotNav from '../BotNav'
import UpgradeButton from './UpgradeButton'
import { SCENARIO_TEAM_PRIJS } from '@/lib/kostenTarieven'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const section: React.CSSProperties = { borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }
const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 16, display: 'block' }
const body: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: 1.9, marginBottom: 24 }

export default async function UpgradePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data } = await supabase
    .from('approved_users')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const plan = (data?.plan as 'basis' | 'premium' | 'team') ?? 'basis'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
      `}</style>

      <BotNav active="account" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
        <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>
          UPGRADE
        </h1>

        {plan === 'basis' && (
          <div style={section}>
            <p style={label}>PRO</p>
            <p style={body}>
              Onbeperkte coaching, gesproken antwoorden met ArnoBot Voice, en 100 berichten per dag in plaats van 25. Vraag hieronder een upgrade aan, Arno regelt de rest persoonlijk.
            </p>
            <UpgradeButton
              href="mailto:arno@arno.bot?subject=Upgrade%20naar%20Pro"
              label="VRAAG AAN →"
              eventName="upgrade_premium_click"
            />
          </div>
        )}

        {plan !== 'team' && (
          <div style={section}>
            <p style={label}>TEAM</p>
            <p style={body}>
              Voor meerdere gebruikers onder één deal. Iedereen in het team krijgt Pro-niveau. Vanaf €{SCENARIO_TEAM_PRIJS.basisMaandelijks} per maand + €{SCENARIO_TEAM_PRIJS.perGebruikerMaandelijks} per gebruiker, vanaf 3 gebruikers. Bekijk de actuele prijs en vraag je team aan.
            </p>
            <UpgradeButton
              href="/team"
              label="BEKIJK TEAM →"
              eventName="upgrade_team_click"
            />
          </div>
        )}

        {plan === 'team' && (
          <p style={body}>Je zit al op het hoogste plan.</p>
        )}
      </div>
    </>
  )
}
