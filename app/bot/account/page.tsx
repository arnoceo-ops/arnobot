'use client'

import { useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BotNav from '../BotNav'
import ReferralSection from '../profiel/ReferralSection'

export default function AccountPage() {
  const { user, isLoaded } = useUser()
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
  const [isTeamMember, setIsTeamMember] = useState(false)
  const [sysStatus, setSysStatus] = useState<'UP' | 'HASISSUES' | 'UNDERINCIDENT' | 'UNDERMAINTENANCE' | null>(null)

  useEffect(() => {
    fetch('/api/bot/cancel-subscription')
      .then(r => r.json())
      .then(d => { if (d.cancelled_at) setCancelledAt(d.cancelled_at) })
      .catch(() => {})
    fetch('/api/bot/team/status')
      .then(r => r.json())
      .then(d => { if (d.hasTeam && !d.isManager) setIsTeamMember(true) })
      .catch(() => {})
    fetch('https://arnobot.instatus.com/summary.json')
      .then(r => r.json())
      .then(d => { if (d?.page?.status) setSysStatus(d.page.status) })
      .catch(() => {})
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
        <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>SUPPORT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, margin: '0 0 32px 0', lineHeight: 1 }}>HERE TO HELP</h1>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 16 }}>
          Voor technische issues, errors of bugs: stuur een mail naar{' '}
          <a href="mailto:support@arno.bot" style={{ color: '#f59e0b', textDecoration: 'none' }}>support@arno.bot</a>
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
            background: sysStatus === 'UP' ? '#22c55e' : sysStatus === null ? '#374151' : '#f59e0b'
          }} />
          <span>
            {sysStatus === 'UP' ? 'Alle systemen werken normaal.' : sysStatus === null ? 'Systeemstatus wordt geladen...' : 'Er zijn momenteel problemen gemeld.'}{' '}
            <a href="https://arnobot.instatus.com" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', textDecoration: 'none' }}>Bekijk de statuspagina</a>
          </span>
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 16 }}>
          Voor administratieve of financiële vragen: stuur een mail naar{' '}
          <a href="mailto:admin@arno.bot" style={{ color: '#f59e0b', textDecoration: 'none' }}>admin@arno.bot</a>
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', marginBottom: 56 }}>
          Voor alle andere vragen:{' '}
          <Link href="/bot/qa" style={{ color: '#f59e0b', textDecoration: 'none' }}>bekijk de Q&A</Link>
        </p>

        {/* Referral — openingssectie (verborgen voor teamleden) */}
        {!isTeamMember && (
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

        {/* Abonnement opzeggen */}
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
              <p style={body}>Je toegang blijft actief tot het einde van de lopende betaalperiode. Je data wordt daarna nog 30 dagen bewaard, zodat je deze kunt downloaden of verwijderen.</p>
              <button
                onClick={() => setCancelConfirm(true)}
                style={{ ...btn, background: 'transparent', color: '#cc2200', border: '1px solid #cc2200' }}
              >
                ABONNEMENT OPZEGGEN
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              <p style={{ color: '#f1f5f9', opacity: 0.7, fontSize: 14, letterSpacing: 1, lineHeight: 1.6 }}>
                Weet je het zeker? Je toegang loopt door tot einde van de periode.
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
