import { createClient } from '@supabase/supabase-js'
import { ACTIE_LABEL, beschrijfDetails, type AdminActie, type AdminLogDetails } from '@/lib/adminLog'

// Logboek van adminacties (arnobot_admin_log), nieuwste eerst. Bevat acties van alle adminpagina's
// (gebruikers, teams, facturatie), daarom staat het op Status en niet bij Gebruikers.
type LogRij = { id: string; created_at: string; actie: AdminActie; doel_user_id: string | null; doel_team_id: string | null; details: AdminLogDetails | null }

export default async function AdminLogboek() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await supabase
    .from('arnobot_admin_log')
    .select('id, created_at, actie, doel_user_id, doel_team_id, details')
    .order('created_at', { ascending: false })
    .limit(30)
  const log = (data ?? []) as LogRij[]

  const ids = [...new Set(log.map(r => r.doel_user_id).filter((x): x is string => !!x))]
  const { data: gebruikers } = ids.length
    ? await supabase.from('approved_users').select('user_id, voornaam, achternaam, email').in('user_id', ids)
    : { data: [] as { user_id: string; voornaam: string | null; achternaam: string | null; email: string | null }[] }
  const naamVoorId = new Map((gebruikers ?? []).map(u => [u.user_id, [u.voornaam, u.achternaam].filter(Boolean).join(' ') || u.email || u.user_id]))

  return (
    <details style={{ background: '#1f2937', borderRadius: 4, marginBottom: 40 }}>
      <summary style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', padding: '14px 20px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>LAATSTE ADMINACTIES</span>
        <span style={{ fontSize: 12 }}>▼</span>
      </summary>
      <div style={{ padding: '0 20px 16px' }}>
      {log.length === 0 ? (
        <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Nog geen adminacties vastgelegd.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {log.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '120px 190px minmax(120px,220px) 1fr', gap: 12, alignItems: 'baseline', background: '#111827', padding: '10px 12px' }}>
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280' }}>
                {new Date(r.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}
              </span>
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, fontWeight: 700, color: '#f1f5f9' }}>{ACTIE_LABEL[r.actie] ?? r.actie}</span>
              <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#9ca3af' }}>{r.doel_user_id ? (naamVoorId.get(r.doel_user_id) ?? r.doel_user_id) : r.doel_team_id ? 'team' : ''}</span>
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{beschrijfDetails(r.details)}</span>
            </div>
          ))}
        </div>
      )}
      </div>
    </details>
  )
}
