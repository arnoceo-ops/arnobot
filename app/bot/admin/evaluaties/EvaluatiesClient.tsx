'use client'

import { useState } from 'react'

interface NegativeRating {
  question: string
  answer: string
  created_at: string
  user_name: string | null
}

interface Props {
  totalRatings: number
  positiveRatings: number
  negativeRatings: NegativeRating[]
}

export default function EvaluatiesClient({ totalRatings, positiveRatings, negativeRatings }: Props) {
  const [expandedRating, setExpandedRating] = useState<number | null>(null)

  if (totalRatings === 0) {
    return <p style={{ color: '#6b7280', fontSize: 12, letterSpacing: 3 }}>NOG GEEN BEOORDELINGEN ONTVANGEN</p>
  }

  return (
    <div>
      <p style={{ fontSize: 12, letterSpacing: 4, color: '#f59e0b', marginBottom: 20 }}>ANTWOORDBEOORDELINGEN</p>
      <div style={{ display: 'flex', gap: 40, marginBottom: 24, alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>
            {Math.round((positiveRatings / totalRatings) * 100)}%
          </span>
          <p style={{ fontSize: 12, letterSpacing: 3, color: '#6b7280', marginTop: 6 }}>POSITIEF</p>
        </div>
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#f1f5f9', lineHeight: 1 }}>
            {totalRatings}
          </span>
          <p style={{ fontSize: 12, letterSpacing: 3, color: '#6b7280', marginTop: 6 }}>BEOORDELINGEN</p>
        </div>
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#cc2200', lineHeight: 1 }}>
            {totalRatings - positiveRatings}
          </span>
          <p style={{ fontSize: 12, letterSpacing: 3, color: '#6b7280', marginTop: 6 }}>NEGATIEF</p>
        </div>
      </div>

      {negativeRatings.length > 0 && (
        <>
          <p style={{ fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 10 }}>
            NEGATIEF BEOORDEELD (LAATSTE {negativeRatings.length})
          </p>
          {negativeRatings.map((r, idx) => (
            <div key={idx} style={{ background: '#1f2937', marginBottom: 2 }}>
              <button
                onClick={() => setExpandedRating(expandedRating === idx ? null : idx)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', gap: 16, textAlign: 'left' }}
              >
                <span style={{ fontSize: 14, color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.question.slice(0, 80)}{r.question.length > 80 ? '...' : ''}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {r.user_name ?? 'onbekend'}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(r.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  {' '}{expandedRating === idx ? '↑' : '↓'}
                </span>
              </button>
              {expandedRating === idx && (
                <div style={{ padding: '0 20px 16px' }}>
                  <p style={{ fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 4 }}>GEBRUIKER</p>
                  <p style={{ fontSize: 14, color: '#f59e0b', marginBottom: 16 }}>{r.user_name ?? 'onbekend'}</p>
                  <p style={{ fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 6 }}>VRAAG</p>
                  <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.7, marginBottom: 16 }}>{r.question}</p>
                  <p style={{ fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 6 }}>ARNO&apos;S ANTWOORD</p>
                  <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{r.answer}</p>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
