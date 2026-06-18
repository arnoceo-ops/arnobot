import { CSSProperties } from 'react'

// ─── Kleuren ────────────────────────────────────────────────────────────────
export const colors = {
  page:        '#111827',
  card:        '#1f2937',
  border:      '#374151',
  text:        '#9ca3af',
  textBright:  '#f1f5f9',
  textMuted:   '#6b7280',
  placeholder: '#4b5563',
  amber:       '#f59e0b',
  amberHover:  '#d97706',
  error:       '#cc2200',
} as const

// ─── Fonts ──────────────────────────────────────────────────────────────────
export const fonts = {
  mono:    "'Space Mono', monospace",
  display: "'Bebas Neue', sans-serif",
} as const

// ─── Tekststijlen ────────────────────────────────────────────────────────────
export const text = {
  body: {
    fontFamily: fonts.mono,
    fontWeight: 400,
    fontSize: 15,
    color: colors.text,
    lineHeight: 1.9,
  } satisfies CSSProperties,

  muted: {
    fontFamily: fonts.mono,
    fontWeight: 400,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 1.9,
  } satisfies CSSProperties,

  // Amber label — sectiekoppen, "BEGIN HET GESPREK", configurator-labels etc.
  label: {
    fontFamily: fonts.mono,
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.amber,
    display: 'block',
    marginBottom: 16,
  } satisfies CSSProperties,

  // Amber label met bold — ALLEEN voor synthesetitels (SYNTHESE / TERUGBLIK)
  labelSynthese: {
    fontFamily: fonts.mono,
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.amber,
    display: 'block',
    marginBottom: 16,
  } satisfies CSSProperties,

  // Subkop binnen AI-content — wit, niet amber
  subheading: {
    fontFamily: fonts.mono,
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.textBright,
  } satisfies CSSProperties,

  h1: {
    fontFamily: fonts.display,
    fontSize: 64,
    letterSpacing: 3,
    color: colors.textBright,
    lineHeight: 1,
  } satisfies CSSProperties,

  h2: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 2,
    color: colors.textBright,
    lineHeight: 1,
  } satisfies CSSProperties,
} as const

// ─── Knoppen ─────────────────────────────────────────────────────────────────
// Gebruik altijd className="btn-primary" / "btn-secondary" / "btn-destructive"
// zodat CSS :hover werkt. De style-prop geeft de basisstijl.
export const btn = {
  primary: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 3,
    padding: '12px 36px',
    background: colors.amber,
    color: colors.page,
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
  } satisfies CSSProperties,

  secondary: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 3,
    padding: '12px 32px',
    background: 'none',
    border: `1px solid ${colors.border}`,
    color: colors.text,
    borderRadius: 999,
    cursor: 'pointer',
  } satisfies CSSProperties,

  destructive: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 3,
    padding: '12px 32px',
    background: 'none',
    border: `1px solid ${colors.error}`,
    color: colors.error,
    borderRadius: 999,
    cursor: 'pointer',
  } satisfies CSSProperties,
} as const

// ─── Input ───────────────────────────────────────────────────────────────────
export const inputStyle: CSSProperties = {
  fontFamily: fonts.mono,
  fontWeight: 400,
  fontSize: 15,
  padding: '12px 16px',
  borderRadius: 4,
  border: `1.5px solid ${colors.border}`,
  background: colors.card,
  color: colors.textBright,
  outline: 'none',
  width: '100%',
}

// ─── Layout ──────────────────────────────────────────────────────────────────
export const layout = {
  page: {
    minHeight: '100vh',
    background: colors.page,
  } satisfies CSSProperties,

  container: {
    maxWidth: 812,
    margin: '0 auto',
    padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px',
  } satisfies CSSProperties,

  section: {
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 32,
    marginBottom: 48,
  } satisfies CSSProperties,

  card: {
    background: colors.card,
    borderLeft: `4px solid ${colors.amber}`,
    padding: '20px 24px',
  } satisfies CSSProperties,
} as const

// ─── Globale CSS-string ──────────────────────────────────────────────────────
// Plak dit in de <style> tag bovenaan elke pagina/client-component.
export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${colors.page}; color: ${colors.textBright}; font-family: ${fonts.mono}; font-weight: 400; }
  .btn-primary:hover  { background: ${colors.amberHover} !important; }
  .btn-secondary:hover { border-color: ${colors.amber} !important; color: ${colors.amber} !important; }
  .btn-destructive:hover { opacity: 0.8; }
`
