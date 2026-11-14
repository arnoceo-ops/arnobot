// De externe diensten waar arno.bot van afhangt en waarvan we de publieke statuspagina volgen
// (Atlassian Statuspage-formaat). Eén lijst voor de pagina /bot/admin/status en voor de
// storingsmelding van /api/cron/storing-wacht, zodat die nooit uit elkaar lopen.
export const EXTERNE_DIENSTEN = [
  { name: 'Anthropic', link: 'https://status.claude.com', url: 'https://status.claude.com/api/v2/summary.json' },
  { name: 'Vercel', link: 'https://www.vercel-status.com', url: 'https://www.vercel-status.com/api/v2/summary.json' },
  { name: 'Supabase', link: 'https://status.supabase.com', url: 'https://status.supabase.com/api/v2/summary.json' },
  { name: 'Clerk', link: 'https://status.clerk.com', url: 'https://status.clerk.com/api/v2/summary.json' },
  { name: 'Resend', link: 'https://resend-status.com', url: 'https://resend-status.com/api/v2/summary.json' },
] as const
