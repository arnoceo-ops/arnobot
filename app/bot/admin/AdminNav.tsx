import AdminMobileNav from './AdminMobileNav'

const CENTER_LINKS = [
  { href: '/bot/admin/gebruikers', label: 'USERS' },
  { href: '/bot/admin', label: 'ARNOBOT' },
  { href: '/bot/admin/status', label: 'STATUS' },
  { href: '/bot/admin/meta-analyse', label: 'META' },
  { href: '/bot/admin/emails', label: 'CRONS' },
  { href: '/bot/admin/evaluaties', label: 'FEEDBACK' },
  { href: '/bot/admin/kennisbank', label: 'KENNISBANK' },
  { href: '/bot/admin/idee', label: 'BLOGS' },
  { href: '/bot/admin/stats', label: 'STATS' },
]

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? '#f59e0b' : '#9ca3af',
    textDecoration: 'none',
    fontSize: '15px',
    letterSpacing: '3px',
    fontWeight: 700,
    padding: '6px 20px',
    borderRadius: 4,
    background: active ? '#1e293b' : 'none',
  }
}

export default function AdminNav({ active }: { active: string }) {
  return (
    <>
      <AdminMobileNav active={active} />
      <nav className="admin-nav" style={{ background: '#0d0d0d', borderBottom: '1px solid #1e293b', height: 56, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 40px' }}>
        <div className="admin-nav-spacer" />
        <div className="admin-nav-center" style={{ display: 'flex', gap: '4px' }}>
          {CENTER_LINKS.map(l => (
            <a key={l.href} href={l.href} style={navLinkStyle(active === l.href)}>{l.label}</a>
          ))}
        </div>
        <div className="admin-nav-right" style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
          <a href="/bot/admin/widget" style={navLinkStyle(active === '/bot/admin/widget')}>ARNO.BLOG</a>
          <a href="/api/admin/logout" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px', letterSpacing: '3px', fontWeight: 700, padding: '6px 12px' }}>UITLOGGEN</a>
        </div>
      </nav>
    </>
  )
}
