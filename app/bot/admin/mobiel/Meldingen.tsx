'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const BEREIK = '/bot/admin/mobiel'

type Stand = 'laden' | 'niet-ondersteund' | 'geblokkeerd' | 'uit' | 'aan'

function sleutelBytes(sleutel: string) {
  const b64 = (sleutel + '='.repeat((4 - (sleutel.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function meld(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch('/api/admin/mobiel/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return res.ok
}

function Knop({ tekst, onClick, bezig, rustig }: { tekst: string; onClick: () => void; bezig: boolean; rustig?: boolean }) {
  return (
    <button onClick={onClick} disabled={bezig} style={{
      minHeight: 44, padding: '0 16px', background: '#111827', color: rustig ? '#9ca3af' : '#44cc88',
      border: '1.5px solid #374151', borderRadius: 4, fontSize: 13, letterSpacing: 2, fontWeight: 700,
      cursor: 'pointer', opacity: bezig ? 0.5 : 1,
    }}>{tekst}</button>
  )
}

export default function Meldingen({ sleutel, bevestigd }: { sleutel: string | null; bevestigd: boolean }) {
  const router = useRouter()
  const [stand, setStand] = useState<Stand>('laden')
  const [bezig, setBezig] = useState(false)
  const [proefVerstuurd, setProefVerstuurd] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    // Een tik op een melding terwijl de app al open staat: ververs de stippen.
    const opBericht = (e: MessageEvent) => { if (e.data === 'ververs') router.refresh() }
    navigator.serviceWorker?.addEventListener('message', opBericht)
    ;(async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setStand('niet-ondersteund')
      if (Notification.permission === 'denied') return setStand('geblokkeerd')
      const registratie = await navigator.serviceWorker.getRegistration(BEREIK)
      const abonnement = await registratie?.pushManager.getSubscription()
      if (!abonnement || Notification.permission !== 'granted') return setStand('uit')
      setStand('aan')
      // Opnieuw doorgeven: herstelt een aanmelding die de server kwijt is.
      await meld({ actie: 'aanmelden', abonnement: abonnement.toJSON() })
    })().catch(() => setStand('uit'))
    return () => navigator.serviceWorker?.removeEventListener('message', opBericht)
  }, [router])

  async function doe(actie: () => Promise<void>) {
    setBezig(true)
    setFout(null)
    try { await actie() } catch { setFout('Dat lukte niet, probeer het opnieuw.') } finally { setBezig(false) }
  }

  const aanzetten = () => doe(async () => {
    if ((await Notification.requestPermission()) !== 'granted') {
      setStand(Notification.permission === 'denied' ? 'geblokkeerd' : 'uit')
      return
    }
    await navigator.serviceWorker.register('/admin-sw.js', { scope: BEREIK })
    // pushManager werkt pas als het script actief is.
    let registratie = await navigator.serviceWorker.getRegistration(BEREIK)
    for (let i = 0; i < 50 && !registratie?.active; i++) {
      await new Promise(r => setTimeout(r, 100))
      registratie = await navigator.serviceWorker.getRegistration(BEREIK)
    }
    if (!registratie?.active) throw new Error('niet actief')
    const abonnement = await registratie.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutelBytes(sleutel!) })
    if (!(await meld({ actie: 'aanmelden', abonnement: abonnement.toJSON() }))) throw new Error('aanmelden')
    setStand('aan')
  })

  const proef = () => doe(async () => {
    if (!(await meld({ actie: 'proef' }))) throw new Error('proef')
    setProefVerstuurd(true)
  })

  const bevestig = () => doe(async () => {
    if (!(await meld({ actie: 'bevestig' }))) throw new Error('bevestig')
    setProefVerstuurd(false)
    router.refresh()
  })

  const uitzetten = () => doe(async () => {
    const registratie = await navigator.serviceWorker.getRegistration(BEREIK)
    const abonnement = await registratie?.pushManager.getSubscription()
    if (abonnement) {
      if (!(await meld({ actie: 'afmelden', endpoint: abonnement.endpoint }))) throw new Error('afmelden')
      await abonnement.unsubscribe()
    }
    setProefVerstuurd(false)
    setStand('uit')
    router.refresh()
  })

  const werkt = stand === 'aan' && bevestigd
  const tekst = !sleutel ? 'Nog niet ingesteld op de server'
    : stand === 'laden' ? 'Controleren'
    : stand === 'niet-ondersteund' ? 'Niet mogelijk in deze browser'
    : stand === 'geblokkeerd' ? 'Geblokkeerd in de instellingen van je telefoon'
    : werkt ? 'Aan'
    : stand === 'aan' ? 'Nog niet bevestigd'
    : 'Uit'

  return (
    <div style={{ background: '#1f2937', borderRadius: 4, marginTop: 24, padding: '16px 18px' }}>
      <p style={{ margin: '0 0 6px', color: '#f59e0b', fontSize: 12, letterSpacing: 3, fontWeight: 700 }}>MELDINGEN</p>
      <p style={{ margin: 0, color: '#f1f5f9', fontSize: 17 }}>{tekst}</p>
      {sleutel && (stand === 'uit' || stand === 'aan') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          {stand === 'uit' && <Knop tekst="MELDINGEN AANZETTEN" onClick={aanzetten} bezig={bezig} />}
          {stand === 'aan' && !bevestigd && <Knop tekst="STUUR PROEFMELDING" onClick={proef} bezig={bezig} />}
          {stand === 'aan' && proefVerstuurd && !bevestigd && <Knop tekst="IK ZIE DE MELDING" onClick={bevestig} bezig={bezig} />}
          {stand === 'aan' && <Knop tekst="UITZETTEN" onClick={uitzetten} bezig={bezig} rustig />}
        </div>
      )}
      {fout && <p style={{ margin: '10px 0 0', color: '#cc4444', fontSize: 14 }}>{fout}</p>}
    </div>
  )
}
