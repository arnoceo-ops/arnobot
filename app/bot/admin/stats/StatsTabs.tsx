'use client'

import { useState } from 'react'

type Tab = { key: string; label: string; content: React.ReactNode }

export default function StatsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0].key)

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, borderBottom: '1px solid #374151' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{
              fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, fontWeight: 700,
              color: active === t.key ? '#f59e0b' : '#6b7280',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px 14px',
              borderBottom: active === t.key ? '2px solid #f59e0b' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.key} style={{ display: active === t.key ? 'block' : 'none' }}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
