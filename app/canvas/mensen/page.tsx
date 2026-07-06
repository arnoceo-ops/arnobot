// @ts-nocheck
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PageHero } from '@/components/canvas/PageHero'

type FieldType = 'textarea' | 'input'
interface FieldDef { id: string; label: string; sub: string; type: FieldType }

const PREFIX = 'mensen'

const ALL_FIELDS: FieldDef[] = [
  { id: 'aantrekkingskracht', label: 'AANTREKKINGSKRACHT', sub: 'Waarom werken mensen voor ons?', type: 'textarea' },
  { id: 'profielen', label: 'PROFIELEN', sub: 'Welke salesprofielen hebben we nodig om onze strategie te laten slagen?', type: 'textarea' },
  { id: 'wervingskanalen', label: 'WERVINGSKANALEN', sub: 'Via welke kanalen vinden we de beste verkopers?', type: 'textarea' },
  { id: 'selectieproces', label: 'SELECTIEPROCES', sub: 'Hoe krijgen we toptalent aan boord?', type: 'textarea' },
  { id: 'behoud_sterspelers', label: 'BEHOUD VAN STERSPELERS', sub: 'Hoe houden we sterspelers binnen de gelederen?', type: 'textarea' },
  { id: 'werving_selectie', label: 'WERVING EN SELECTIE', sub: 'Hoeveel tijd beslaat het proces van vacature tot eerste werkdag?', type: 'textarea' },
  { id: 'onboarding', label: 'ONBOARDING', sub: 'Binnen hoeveel maanden realiseert een verkoper 100% van de doelstelling?', type: 'textarea' },
  { id: 'tijd_rendement', label: 'TIJD TOT VOLLEDIG RENDEMENT', sub: 'Hoeveel tijd van vacature tot 100% doelstelling?', type: 'textarea' },
  { id: 'actieplan', label: 'ACTIEPLAN', sub: '', type: 'textarea' },
]

async function getArnoBotFeedback(label: string, sub: string, answer: string): Promise<string> {
  if (!answer.trim()) return 'Vul dit veld in voor ArnoBot feedback.'
  const res = await fetch('/api/arnobot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, sub, answer }) })
  if (!res.ok) throw new Error('ArnoBot request failed')
  return (await res.json()).feedback
}

const BEBAS: React.CSSProperties = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '26px', letterSpacing: '3px', color: '#1a1714' }
const MONO18: React.CSSProperties = { fontFamily: 'var(--font-space-mono, monospace)', fontSize: '18px', color: '#1a1714' }
const MONO_SUB: React.CSSProperties = { ...MONO18, opacity: 0.5, marginBottom: '14px' }
const LINE: React.CSSProperties = { flex: 1, height: '1px', backgroundColor: '#e0d8cc' }

function AutoTextarea({ value, onChange, onBlur, style }: { value: string; onChange: (v: string) => void; onBlur: () => void; style?: React.CSSProperties }) {
  const setHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  return (
    <textarea
      ref={setHeight}
      style={{ ...style, overflow: 'hidden', resize: 'none' }}
      value={value}
      onInput={e => setHeight(e.currentTarget)}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="..."
      rows={3}
    />
  )
}

function ArnobotBox({ text, onClose, style }: { text: string; onClose: () => void; style?: React.CSSProperties }) {
  return (
    <div style={{ marginTop: '12px', borderLeft: '2px solid #f59e0b', fontSize: '18px', lineHeight: 1.8, color: '#1a1714', opacity: 0.8, fontFamily: 'var(--font-space-mono, monospace)', backgroundColor: '#fdf6ec', padding: '12px', whiteSpace: 'pre-wrap', ...style }}>
      {text}
      <button onClick={onClose} style={{ marginTop: '12px', display: 'block', background: 'none', border: 'none', color: '#f59e0b', fontSize: '11px', letterSpacing: '2px', cursor: 'pointer', padding: '0' }}>
        {'→ SLUITEN'}
      </button>
    </div>
  )
}

const s = {
  page: { backgroundColor: '#f5f0e8', minHeight: '100vh', color: '#1a1714', fontFamily: 'var(--font-barlow, sans-serif)' } as React.CSSProperties,
  nav: { display: 'flex', alignItems: 'center', gap: '16px', padding: '24px 48px', fontFamily: 'var(--font-bebas), sans-serif', fontSize: '36px', letterSpacing: '3px', borderBottom: '1px solid #e0d8cc', position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#f5f0e8' } as React.CSSProperties,
  sectionDivider: { borderTop: '1px solid #e0d8cc', padding: '48px 48px 0' } as React.CSSProperties,
  fieldLabel: { ...BEBAS, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px' } as React.CSSProperties,
  fieldLabelLine: LINE,
  fieldSub: MONO_SUB,
  textarea: { width: '100%', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #e0d8cc', color: '#1a1714', fontSize: '18px', padding: '12px 0', resize: 'none' as const, outline: 'none', fontFamily: 'var(--font-space-mono, monospace)', lineHeight: 1.8, minHeight: '100px', boxSizing: 'border-box' as const },
  input: { width: '100%', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #e0d8cc', color: '#1a1714', fontSize: '18px', padding: '10px 0', outline: 'none', fontFamily: 'var(--font-space-mono, monospace)', boxSizing: 'border-box' as const },
  arnobotBtn: { marginTop: '8px', background: 'none', border: 'none', color: '#f59e0b', fontSize: '11px', letterSpacing: '2px', cursor: 'pointer', padding: '0' } as React.CSSProperties,
  arnobotBox: { marginTop: '12px', borderLeft: '2px solid #f59e0b', paddingLeft: '12px', fontSize: '18px', lineHeight: 1.8, color: '#1a1714', opacity: 0.8, fontFamily: 'var(--font-space-mono, monospace)', backgroundColor: '#fdf6ec', padding: '12px' } as React.CSSProperties,
  saveStatus: { position: 'fixed' as const, bottom: '24px', right: '24px', fontSize: '11px', letterSpacing: '3px', color: '#f59e0b', opacity: 0.8 },
  groupLabel: { ...BEBAS, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' } as React.CSSProperties,
  groupSub: MONO_SUB,
}

interface FieldProps {
  id: string; label: string; sub: string; type: FieldType
  value: string; onChange: (id: string, v: string) => void; onBlur: (id: string) => void
  feedback: string; loading: boolean; onArnoBot: (id: string, label: string, sub: string) => void
}

function Field({ id, label, sub, type, value, onChange, onBlur, feedback, loading, onArnoBot }: FieldProps) {
  const hasAnswer = !!value.trim()
  return (
    <div>
      <div style={s.fieldLabel}>{label}<span style={s.fieldLabelLine} /></div>
      {sub && <div style={s.fieldSub}>{sub}</div>}
      {type === 'textarea'
        ? <AutoTextarea style={s.textarea} value={value} onChange={v => onChange(id, v)} onBlur={() => onBlur(id)} />
        : <input style={s.input} value={value} onChange={e => onChange(id, e.target.value)} onBlur={() => onBlur(id)} placeholder="..." />
      }
      {hasAnswer && (
        <button style={{ ...s.arnobotBtn, opacity: 0.7 }} onClick={() => !loading && onArnoBot(id, label, sub)}>
          {loading ? '→ ARNOBOT DENKT...' : feedback ? '→ OPNIEUW VRAGEN' : '→ ARNOBOT'}
        </button>
      )}
      {feedback && !loading && <ArnobotBox text={feedback} onClose={() => onArnoBot(id, '__clear__', '')} />}
    </div>
  )
}

interface QRowProps {
  label: string; id: string
  answers: Record<string, string>; onChange: (id: string, v: string) => void; onBlur: (id: string) => void
  feedback: Record<string, string>; loading: Record<string, boolean>; onArnoBot: (id: string, label: string, sub: string) => void
}

function QRow({ label, id, answers, onChange, onBlur, feedback, loading, onArnoBot }: QRowProps) {
  const hasAnswer = !!answers[id]?.trim()
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
        <span style={{ ...MONO18, opacity: 0.5 }}>{label}</span>
        <input
          style={{ backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #e0d8cc', color: '#1a1714', fontSize: '18px', padding: '4px 0', outline: 'none', fontFamily: 'var(--font-space-mono, monospace)', width: '100%', boxSizing: 'border-box' as const }}
          value={answers[id] || ''} onChange={e => onChange(id, e.target.value)} onBlur={() => onBlur(id)} placeholder="..."
        />
      </div>
      {hasAnswer && (
        <button style={{ ...s.arnobotBtn, opacity: 0.7, marginLeft: '172px' }} onClick={() => !loading[id] && onArnoBot(id, label, '')}>
          {loading[id] ? '→ ARNOBOT DENKT...' : feedback[id] ? '→ OPNIEUW VRAGEN' : '→ ARNOBOT'}
        </button>
      )}
      {feedback[id] && !loading[id] && <ArnobotBox text={feedback[id]} onClose={() => onArnoBot(id, '__clear__', '')} style={{ marginLeft: '172px' }} />}
    </div>
  )
}

function QuarterBlock({ quarter, prefix, answers, onChange, onBlur, feedback, loading, onArnoBot }: { quarter: string; prefix: string } & Omit<QRowProps, 'label' | 'id'>) {
  const rows = [
    { label: '# verkopers', id: `${prefix}_aantal` },
    { label: '# die blijven', id: `${prefix}_blijven` },
    { label: '# uitbreiding', id: `${prefix}_uitbreiding` },
    { label: '# nieuwe sales', id: `${prefix}_nieuw` },
  ]
  return (
    <div style={{ borderTop: '1px solid #e0d8cc', paddingTop: '20px' }}>
      <div style={{ ...BEBAS, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {quarter}<span style={LINE} />
      </div>
      {rows.map(r => <QRow key={r.id} label={r.label} id={r.id} answers={answers} onChange={onChange} onBlur={onBlur} feedback={feedback} loading={loading} onArnoBot={onArnoBot} />)}
    </div>
  )
}

export default function MensenPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const pathname = usePathname()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState('')
  const [arnobotFeedback, setArnobotFeedback] = useState<Record<string, string>>({})
  const [arnobotLoading, setArnobotLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase.from('canvas_answers').select('question_id, answer').eq('user_id', user.id).like('question_id', `${PREFIX}_%`)
      if (data) {
        const map: Record<string, string> = {}
        data.forEach(r => { map[r.question_id.slice(PREFIX.length + 1)] = r.answer })
        setAnswers(map)
      }
    })()
  }, [user])

  const save = useCallback(async (id: string, value: string) => {
  if (!user) return
  setSaveStatus('OPSLAAN...')
  const isEmpty = !value.trim()
  const { error } = await supabase.from('canvas_answers').upsert(
    { user_id: user.id, question_id: `${PREFIX}_${id}`, answer: value, ...(isEmpty ? { score: null } : {}) },
    { onConflict: 'user_id,question_id' }
  )
  if (error) { console.error('SAVE ERROR:', error.code, error.message); setSaveStatus('FOUT ✗'); return }
  setSaveStatus('OPGESLAGEN ✓')
  setTimeout(() => setSaveStatus(''), 2000)
}, [user])

  const handleChange = useCallback((id: string, value: string) => setAnswers(prev => ({ ...prev, [id]: value })), [])
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])
  const handleBlur = useCallback((id: string) => { save(id, answersRef.current[id] || '') }, [save])

  const handleArnoBot = useCallback((id: string, label: string, sub: string) => {
    if (label === '__clear__') { setArnobotFeedback(f => ({ ...f, [id]: '' })); return }
    setAnswers(prev => {
      const answer = prev[id] || ''
      setArnobotLoading(l => ({ ...l, [id]: true }))
      setArnobotFeedback(f => ({ ...f, [id]: '' }))
      getArnoBotFeedback(label, sub, answer)
        .then(fb => setArnobotFeedback(f => ({ ...f, [id]: fb })))
        .catch(() => setArnobotFeedback(f => ({ ...f, [id]: 'ArnoBot is tijdelijk niet beschikbaar.' })))
        .finally(() => setArnobotLoading(l => ({ ...l, [id]: false })))
      return prev
    })
  }, [])

  const fp = (id: string) => ({ value: answers[id] || '', onChange: handleChange, onBlur: handleBlur, feedback: arnobotFeedback[id] || '', loading: arnobotLoading[id] || false, onArnoBot: handleArnoBot })
  const f = (id: string) => ALL_FIELDS.find(x => x.id === id)!
  const qProps = { answers, onChange: handleChange, onBlur: handleBlur, feedback: arnobotFeedback, loading: arnobotLoading, onArnoBot: handleArnoBot }

  const navLink = (href: string, label: string) => (
    <Link href={href} style={{ color: pathname === href ? '#f59e0b' : '#1a1714', textDecoration: 'none', opacity: pathname === href ? 1 : 0.4 }}>
      {label}
    </Link>
  )

  return (
    <main style={s.page}>
      <nav style={s.nav}>
        <Link href="/canvas" style={{ color: '#1a1714', textDecoration: 'none', opacity: 0.4 }}>← CANVAS</Link>
        <span style={{ opacity: 0.2 }}>/</span>
        {navLink('/canvas/strategie', 'STRATEGIE')}
        <span style={{ opacity: 0.2 }}>/</span>
        {navLink('/canvas/mensen', 'MENSEN')}
        <span style={{ opacity: 0.2 }}>/</span>
        {navLink('/canvas/uitvoering', 'UITVOERING')}
      </nav>

      <PageHero number={2} />

      <div style={{ ...s.sectionDivider, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', paddingBottom: '48px' }}>
        <Field {...f('aantrekkingskracht')} {...fp('aantrekkingskracht')} />
        <Field {...f('profielen')} {...fp('profielen')} />
      </div>

      <div style={{ ...s.sectionDivider, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '48px', paddingBottom: '64px' }}>
        <Field {...f('wervingskanalen')} {...fp('wervingskanalen')} />
        <Field {...f('selectieproces')} {...fp('selectieproces')} />
        <Field {...f('behoud_sterspelers')} {...fp('behoud_sterspelers')} />
      </div>

      <div style={{ padding: '0 48px 48px', borderTop: '1px solid #e0d8cc' }}>
        <div style={{ ...s.groupLabel, marginTop: '48px' }}>
          BENODIGDE CAPACITEIT
          <span style={{ ...MONO_SUB, marginBottom: 0 }}>Hoeveel verkopers hebben we nodig om het jaardoel te halen?</span>
          <span style={LINE} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
          <QuarterBlock quarter="Q1" prefix="verkopers_q1" {...qProps} />
          <QuarterBlock quarter="Q2" prefix="verkopers_q2" {...qProps} />
          <QuarterBlock quarter="Q3" prefix="verkopers_q3" {...qProps} />
          <QuarterBlock quarter="Q4" prefix="verkopers_q4" {...qProps} />
        </div>
      </div>

      <div style={{ ...s.sectionDivider, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', paddingBottom: '48px' }}>
        <Field {...f('werving_selectie')} {...fp('werving_selectie')} />
        <Field {...f('onboarding')} {...fp('onboarding')} />
      </div>

      <div style={{ ...s.sectionDivider, paddingBottom: '48px' }}>
        <Field {...f('tijd_rendement')} {...fp('tijd_rendement')} />
      </div>

      <div style={{ ...s.sectionDivider, paddingBottom: '80px' }}>
        <Field {...f('actieplan')} {...fp('actieplan')} />
      </div>

      {saveStatus && <p style={s.saveStatus}>{saveStatus}</p>}
    </main>
  )
}