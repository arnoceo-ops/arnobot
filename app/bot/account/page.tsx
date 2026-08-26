'use client'

import { useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BotNav from '../BotNav'
import ReferralSection from '../profiel/ReferralSection'
import { useIsMobile } from '@/hooks/useBreakpoint'
import { useTeamStatus } from '@/hooks/useTeamStatus'

export default function AccountPage() {
  const { user, isLoaded } = useUser()
  const isMobile = useIsMobile()
  const { signOut } = useClerk()
  const router = useRouter()

  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteDone, setDeleteDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelledAt, setCancelledAt] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)
  // isTeamMember mag hier alleen gebruikt worden als loaded && !failed: bij een mislukte
  // fetch (failed) tonen we de REFERRAL-/ABONNEMENT-secties niet automatisch, dat zou een
  // teamlid ten onrechte toegang tot een sectie geven die voor hem verborgen hoort te zijn.
  const { isTeamMember, isManager, memberCount, loaded: teamStatusLoaded, failed: teamStatusFailed } = useTeamStatus()
  const [appPassword, setAppPassword] = useState('')
  const [appPasswordConfirm, setAppPasswordConfirm] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordDone, setPasswordDone] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [sysStatus, setSysStatus] = useState<'UP' | 'HASISSUES' | 'UNDERINCIDENT' | 'UNDERMAINTENANCE' | null>(null)
  const [metrics, setMetrics] = useState<{ status: string; avgMs: number | null; p95: number | null; availDay: number | null; availWeek: number | null; downSeconds: number } | null>(null)
  // De Android-app is Pro/Team-only (zie /prijzen), Basic mist 'm. Zonder deze gate zag elke
  // gebruiker de sectie ongeacht plan, ook een teruggevallen trial-gebruiker na 30 dagen.
  const [plan, setPlan] = useState<'basis' | 'premium' | 'team' | null>(null)
  const [planLoaded, setPlanLoaded] = useState(false)

  useEffect(() => {
    // Clerk weet al of dit account een wachtwoord heeft (LinkedIn-only-accounts hebben er
    // standaard geen), dus hier geen aparte API-call voor nodig. Zonder deze sync toonde de
    // pagina na elke herlaad/nieuwe login weer de lege invoervelden, ook als het wachtwoord
    // al goed stond, want passwordDone was tot nu toe puur lokale state.
    if (user?.passwordEnabled) setPasswordDone(true)
  }, [user?.passwordEnabled])

  useEffect(() => {
    fetch('/api/bot/cancel-subscription')
      .then(r => r.json())
      .then(d => { if (d.cancelled_at) setCancelledAt(d.cancelled_at) })
      .catch(() => {})
    fetch('/api/bot/instatus')
      .then(r => r.json())
      .then(d => {
        if (d?.status) {
          setMetrics(d)
          setSysStatus(d.status as 'UP' | 'HASISSUES' | 'UNDERINCIDENT' | 'UNDERMAINTENANCE')
        }
      })
      .catch(() => {})
    fetch('/api/bot/plan')
      .then(r => r.json())
      .then(d => setPlan(d.plan ?? 'basis'))
      .catch(() => {})
      .finally(() => setPlanLoaded(true))
  }, [])

  if (!isLoaded) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
      `}</style>
      <BotNav active="account" />
    </>
  )

  async function handleCancel() {
    setCancelling(true)
    setError(null)
    try {
      const res = await fetch('/api/bot/cancel-subscription', { method: 'POST' })
      if (!res.ok) throw new Error('Opzegging mislukt')
      const data = await res.json()
      setCancelledAt(data.cancelled_at)
      setCancelConfirm(false)
      setCancelDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opzegging mislukt')
    } finally {
      setCancelling(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setExportDone(false)
    setError(null)
    try {
      const res = await fetch('/api/bot/export')
      if (!res.ok) throw new Error('Export mislukt')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arnobot-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export mislukt')
    } finally {
      setExporting(false)
    }
  }

  async function handleSetPassword() {
    setPasswordError(null)
    if (appPassword.length < 8) {
      setPasswordError('Wachtwoord moet minimaal 8 tekens zijn.')
      return
    }
    if (appPassword !== appPasswordConfirm) {
      setPasswordError('Wachtwoorden komen niet overeen.')
      return
    }
    setSettingPassword(true)
    try {
      const res = await fetch('/api/bot/set-app-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: appPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Wachtwoord instellen mislukt')
      setAppPassword('')
      setAppPasswordConfirm('')
      setPasswordDone(true)
      setShowPasswordForm(false)
    } catch (e: unknown) {
      setPasswordError(e instanceof Error ? e.message : 'Wachtwoord instellen mislukt')
    } finally {
      setSettingPassword(false)
    }
  }

  async function handleDelete() {
    if (deleteInput !== 'VERWIJDER') return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/bot/delete-account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Verzoek mislukt')
      setDeleteDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verzoek mislukt')
    } finally {
      setDeleting(false)
    }
  }

  const section: React.CSSProperties = { borderTop: '1px solid #374151', paddingTop: '32px', marginBottom: '48px' }
  const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }
  const body: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: '15px', lineHeight: '1.9', marginBottom: '24px' }
  const btn: React.CSSProperties = { padding: '12px 36px', border: 'none', background: '#f59e0b', color: '#111827', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '3px', cursor: 'pointer', transition: 'background 0.2s', borderRadius: '999px', display: 'inline-block', minWidth: '260px', textAlign: 'center' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        input { background: #1f2937; border: 1.5px solid #374151; color: #f1f5f9; font-family: 'Space Mono', monospace; font-size: 15px; letter-spacing: 2px; padding: 12px 16px; outline: none; width: 100%; }
        input:focus { border-color: #f59e0b; }
        .primary-btn:hover { background: #d97706 !important; }
      `}</style>

      <BotNav active="account" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        {/* Support sectie */}
        <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>HERE TO HELP</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, margin: '0 0 32px 0', lineHeight: 1 }}>SUPPORT</h1>

        {/* Systeemstatus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: sysStatus === 'UP' ? '#22c55e' : sysStatus === null ? '#374151' : '#f59e0b'
          }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af' }}>
            {sysStatus === 'UP' ? 'Alle systemen werken normaal.' : sysStatus === null ? 'Systeemstatus wordt geladen...' : 'Er zijn momenteel problemen gemeld.'}
          </span>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: sysStatus !== 'UP' && sysStatus !== null ? 16 : 32 }}>
          <div style={{ background: '#1f2937', borderRadius: 4, padding: '16px 20px' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>PERFORMANCE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>GEMIDDELD</p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#f1f5f9', lineHeight: 1 }}>
                  {metrics?.avgMs ? `${metrics.avgMs}ms` : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>P95</p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#f1f5f9', lineHeight: 1 }}>
                  {metrics?.p95 ? `${metrics.p95}ms` : '—'}
                </p>
              </div>
            </div>
          </div>
          <div style={{ background: '#1f2937', borderRadius: 4, padding: '16px 20px' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>BESCHIKBAARHEID</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>VANDAAG</p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#f1f5f9', lineHeight: 1 }}>
                  {metrics?.availDay !== null && metrics?.availDay !== undefined ? `${metrics.availDay}%` : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>DEZE WEEK</p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#f1f5f9', lineHeight: 1 }}>
                  {metrics?.availWeek !== null && metrics?.availWeek !== undefined ? `${metrics.availWeek}%` : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>DOWN</p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#f1f5f9', lineHeight: 1 }}>
                  {metrics ? (metrics.downSeconds > 0 ? `${Math.round(metrics.downSeconds / 60)}min` : '0s') : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Storing melding */}
        {sysStatus !== null && sysStatus !== 'UP' && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 32 }}>
            De storing is zichtbaar en geregistreerd. Herstel is afhankelijk van de betrokken externe partij.
          </p>
        )}

        {/* Contactgegevens */}
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 16 }}>
          Voor technische issues, errors of bugs: stuur een mail naar{' '}
          <a href="mailto:support@arno.bot" style={{ color: '#f59e0b', textDecoration: 'none' }}>support@arno.bot</a>
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 16 }}>
          Voor administratieve of financiële vragen: stuur een mail naar{' '}
          <a href="mailto:admin@arno.bot" style={{ color: '#f59e0b', textDecoration: 'none' }}>admin@arno.bot</a>
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 56 }}>
          Voor alle andere vragen: ga naar{' '}
          <a href="https://arno.bot/qa" style={{ color: '#f59e0b', textDecoration: 'none' }}>arno.bot/qa</a>
        </p>

        {/* Referral — openingssectie (verborgen voor teamleden) */}
        {teamStatusLoaded && !teamStatusFailed && !isTeamMember && (
          <>
            <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>REFERRAL</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, margin: '0 0 32px 0', lineHeight: 1 }}>JOUW REFERRAL CODE</h1>
            <ReferralSection inAccount />
          </>
        )}


        {/* Gegevens — tweede sectie */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 48, marginTop: 56 }}>
          <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ACCOUNT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, margin: '0 0 40px 0', color: '#f1f5f9', lineHeight: 1 }}>JOUW GEGEVENS</h1>
        </div>

        {/* Privacy statement */}
        <div style={{ background: '#1f2937', borderLeft: '4px solid #f59e0b', padding: '20px 24px', marginBottom: 20 }}>
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }}>JOUW DATA IS VAN JOU</p>
          <p style={{ fontSize: 15, lineHeight: '1.9', color: '#9ca3af' }}>
            Alles wat je hier invoert en bespreekt met ArnoBot, is 100% veilig opgeslagen en wordt nooit gedeeld met derden, gebruikt voor marketing of ingezet voor andere doeleinden dan jouw persoonlijke coaching. Je kunt je gegevens op elk moment downloaden of je account volledig verwijderen.
          </p>
        </div>

        {/* Voorwaarden en privacy — direct onder privacy statement */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 48 }}>
          <Link href="/voorwaarden" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#6b7280', textDecoration: 'none' }}>
            VOORWAARDEN
          </Link>
          <Link href="/privacy" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#6b7280', textDecoration: 'none' }}>
            PRIVACY
          </Link>
        </div>

        {/* Profiel */}
        <div style={section}>
          <p style={label}>ARNOBOT PROFIEL</p>
          <p style={body}>Pas je profiel aan zodat ArnoBot beter op jou is afgestemd.</p>
          <Link href="/bot/profiel" className="primary-btn" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
            PROFIEL AANPASSEN
          </Link>
        </div>

        {/* App-wachtwoord — Pro/Team-only, zie /prijzen */}
        {planLoaded && plan !== 'basis' && (
        <div style={section}>
          <p style={label}>ANDROID APP</p>
          <p style={body}>
            Je meldt je aan met LinkedIn. Voor de Android-app heb je daarnaast een wachtwoord nodig, want inloggen met LinkedIn kan daar niet. Stel hier een wachtwoord in, en gebruik dat samen met hetzelfde e-mailadres als je LinkedIn-account om in te loggen in de Android-app.
          </p>
          {passwordDone && !showPasswordForm ? (
            <p style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 2 }}>✓ Wachtwoord ingesteld</span>
              <button
                onClick={() => setShowPasswordForm(true)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: '4px', color: '#6b7280' }}
              >
                WIJZIGEN
              </button>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
              <input
                type="password"
                value={appPassword}
                onChange={e => setAppPassword(e.target.value)}
                placeholder="Nieuw wachtwoord (min. 8 tekens)"
              />
              <input
                type="password"
                value={appPasswordConfirm}
                onChange={e => setAppPasswordConfirm(e.target.value)}
                placeholder="Herhaal wachtwoord"
              />
              <button
                onClick={handleSetPassword}
                disabled={settingPassword}
                className="primary-btn"
                style={{ ...btn, alignSelf: 'flex-start', background: settingPassword ? '#374151' : '#f59e0b', color: settingPassword ? '#4b5563' : '#111827', cursor: settingPassword ? 'not-allowed' : 'pointer' }}
              >
                {settingPassword ? 'BEZIG...' : 'VERZEND'}
              </button>
              {passwordError && <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1 }}>✗ {passwordError}</p>}
            </div>
          )}
        </div>
        )}

        {/* Data export */}
        <div style={section}>
          <p style={label}>JOUW DATA</p>
          <p style={body}>Download een volledig overzicht van alle gegevens die ArnoBot over jou heeft opgeslagen. Je ontvangt een JSON-bestand.</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="primary-btn"
            style={{ ...btn, background: exporting ? '#374151' : '#f59e0b', color: exporting ? '#4b5563' : '#111827', cursor: exporting ? 'not-allowed' : 'pointer' }}
          >
            {exporting ? 'EXPORTEREN...' : 'DOWNLOAD MIJN DATA'}
          </button>
          {exportDone && <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 2, marginTop: 12 }}>✓ Download gestart</p>}
        </div>

        {/* Nieuwe sectie: Genoeg geweest */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 48, marginBottom: 0 }}>
          <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ABONNEMENT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, margin: '0 0 40px 0', color: '#f1f5f9', lineHeight: 1 }}>GENOEG GEWEEST?</h1>
        </div>

        {/* Abonnement opzeggen — verborgen voor gewone teamleden, dat is de manager's
            abonnement, niet het hunne. Voor de manager zelf wél zichtbaar (hij betaalt het
            teamabonnement), met aangepaste tekst die het teambrede effect benoemt.
            ACCOUNT VERWIJDEREN eronder blijft voor iedereen zichtbaar, dat is een AVG-recht
            op verwijdering van eigen persoonsgegevens, los van wie betaalt. */}
        {teamStatusLoaded && !teamStatusFailed && !isTeamMember && (
        <div style={section}>
          <p style={{ ...label, color: '#cc2200' }}>ABONNEMENT OPZEGGEN</p>
          {cancelledAt ? (
            <p style={body}>
              Je opzegging is ontvangen op {new Date(cancelledAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}. Je toegang blijft actief tot het einde van de lopende periode. Je data blijft bewaard totdat je account wordt afgesloten.
            </p>
          ) : cancelDone ? (
            <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 2 }}>✓ Opzegging ontvangen</p>
          ) : !cancelConfirm ? (
            <>
              <p style={body}>
                {isManager
                  ? `Dit beëindigt het teamabonnement voor je hele team van ${memberCount ?? 'meerdere'} leden, niet alleen jouw eigen toegang. De toegang blijft actief tot het einde van de lopende betaalperiode.`
                  : 'Je toegang blijft actief tot het einde van de lopende betaalperiode. Je data wordt daarna nog 30 dagen bewaard, zodat je deze kunt downloaden of verwijderen.'}
              </p>
              <button
                onClick={() => setCancelConfirm(true)}
                style={{ ...btn, background: 'transparent', color: '#cc2200', border: '1px solid #cc2200' }}
              >
                {isManager ? 'TEAMABONNEMENT OPZEGGEN' : 'ABONNEMENT OPZEGGEN'}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              <p style={{ color: '#f1f5f9', opacity: 0.7, fontSize: 14, letterSpacing: 1, lineHeight: 1.6 }}>
                {isManager
                  ? `Weet je het zeker? Dit beëindigt de toegang voor jou én je hele team van ${memberCount ?? 'meerdere'} leden aan het einde van de periode.`
                  : 'Weet je het zeker? Je toegang loopt door tot einde van de periode.'}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{ ...btn, background: !cancelling ? '#cc2200' : '#374151', color: !cancelling ? '#fff' : '#4b5563', cursor: cancelling ? 'not-allowed' : 'pointer' }}
                >
                  {cancelling ? 'VERWERKEN...' : 'JA, OPZEGGEN'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  style={{ ...btn, background: 'transparent', color: '#f1f5f9', border: '1px solid #374151', opacity: 0.5 }}
                >
                  ANNULEREN
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Account verwijderen */}
        <div style={{ ...section, marginBottom: 0 }}>
          <p style={{ ...label, color: '#cc2200' }}>ACCOUNT VERWIJDEREN</p>
          <p style={body}>Je kunt hier een verzoek indienen om je account en persoonsgegevens te verwijderen. We verwerken dit binnen 10 werkdagen.</p>

          {deleteDone ? (
            <div style={{ background: '#1f2937', borderLeft: '3px solid #44cc88', padding: '20px 24px' }}>
              <p style={{ color: '#44cc88', fontSize: 13, letterSpacing: 2 }}>✓ Verzoek ontvangen. We verwerken dit binnen 10 werkdagen.</p>
            </div>
          ) : !deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{ ...btn, background: 'transparent', color: '#cc2200', border: '1px solid #cc2200' }}
            >
              ACCOUNT VERWIJDEREN
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              <p style={{ color: '#f1f5f9', opacity: 0.7, fontSize: 14, letterSpacing: 1, lineHeight: 1.6 }}>
                Typ <strong>VERWIJDER</strong> om het verzoek te bevestigen:
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="VERWIJDER"
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleDelete}
                  disabled={deleteInput !== 'VERWIJDER' || deleting}
                  style={{ ...btn, background: deleteInput === 'VERWIJDER' && !deleting ? '#cc2200' : '#374151', color: deleteInput === 'VERWIJDER' && !deleting ? '#fff' : '#4b5563', cursor: deleteInput === 'VERWIJDER' && !deleting ? 'pointer' : 'not-allowed' }}
                >
                  {deleting ? 'BEZIG...' : 'VERWIJDER'}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteInput('') }}
                  style={{ ...btn, background: 'transparent', color: '#f1f5f9', border: '1px solid #374151', opacity: 0.5 }}
                >
                  ANNULEREN
                </button>
              </div>
            </div>
          )}
        </div>

{error && <p style={{ color: '#cc2200', fontSize: 14, letterSpacing: 1, marginTop: 24 }}>✗ {error}</p>}

      </div>
    </>
  )
}
