'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        fontFamily: 'sans-serif',
        fontSize: 12,
        letterSpacing: 2,
        padding: '6px 16px',
        border: '1px solid #374151',
        borderRadius: 3,
        background: 'transparent',
        color: '#9ca3af',
        cursor: 'pointer',
      }}
    >
      AFDRUKKEN / OPSLAAN ALS PDF
    </button>
  )
}
