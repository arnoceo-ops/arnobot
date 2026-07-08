import Link from 'next/link'
import React from 'react'

type FlowStep = 'gesprek' | 'analyses' | 'coaching'

const STEPS: { key: FlowStep; label: string; href: string }[] = [
  { key: 'gesprek', label: 'GESPREK', href: '/bot' },
  { key: 'analyses', label: 'ANALYSES', href: '/bot/analyses' },
  { key: 'coaching', label: 'COACHING', href: '/bot/coaching' },
]

const arrowStyle: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: 10,
  color: '#374151',
  userSelect: 'none',
}

const activeStyle: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: 11,
  letterSpacing: 4,
  color: '#f59e0b',
}

export function FlowStrip({ active }: { active: FlowStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          {i > 0 && <span style={arrowStyle}>›</span>}
          {step.key === active ? (
            <span style={activeStyle}>{step.label}</span>
          ) : (
            <Link href={step.href} className="flow-link">
              {step.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
