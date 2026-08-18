'use client'

import { useState } from 'react'

type Agent = 'sales_agent_1' | 'sales_agent_2' | null
type Method = 'link' | 'contact_match' | 'round_robin' | null

const OPTIONS: { value: string; agent: Agent; method: Method; label: string }[] = [
  { value: 'none', agent: null, method: null, label: 'Geen' },
  { value: 'a1_contact', agent: 'sales_agent_1', method: 'contact_match', label: 'Agent 1, contact' },
  { value: 'a1_round', agent: 'sales_agent_1', method: 'round_robin', label: 'Agent 1, round robin' },
  { value: 'a2_contact', agent: 'sales_agent_2', method: 'contact_match', label: 'Agent 2, contact' },
  { value: 'a2_round', agent: 'sales_agent_2', method: 'round_robin', label: 'Agent 2, round robin' },
]

function toValue(agent: Agent, method: Method): string {
  if (!agent) return 'none'
  const match = OPTIONS.find(o => o.agent === agent && o.method === method)
  return match?.value ?? 'none'
}

// Leads die via de eigen link binnenkwamen (method 'link') worden automatisch gezet in
// proxy.ts, dat wordt hier bewust niet editeerbaar: een badge i.p.v. een dropdown, om te
// voorkomen dat een automatische, betrouwbare toewijzing per ongeluk overschreven wordt.
export default function SdAgentSelect({ userId, initialAgent, initialMethod }: {
  userId: string
  initialAgent: Agent
  initialMethod: Method
}) {
  const [agent, setAgent] = useState(initialAgent)
  const [method, setMethod] = useState(initialMethod)
  const [loading, setLoading] = useState(false)

  if (initialMethod === 'link') {
    return (
      <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: '#6b7280' }}>
        {initialAgent === 'sales_agent_1' ? 'AGENT 1' : 'AGENT 2'} (LINK)
      </span>
    )
  }

  async function handleChange(value: string) {
    const opt = OPTIONS.find(o => o.value === value)
    if (!opt) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sd-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sdAgent: opt.agent, sdAttributionMethod: opt.method }),
      })
      if (res.ok) {
        setAgent(opt.agent)
        setMethod(opt.method)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      value={toValue(agent, method)}
      disabled={loading}
      onChange={e => handleChange(e.target.value)}
      style={{
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 4px',
        borderRadius: 6,
        border: '1px solid #374151',
        background: agent ? '#1e293b' : '#111827',
        color: agent ? '#f1f5f9' : '#6b7280',
        cursor: loading ? 'wait' : 'pointer',
        maxWidth: 110,
      }}
    >
      {OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
