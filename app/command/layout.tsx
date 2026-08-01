import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ArnoBot: Command voor teams',
  description: 'Vraag ArnoBot Command aan voor je team: meerdere seats onder één deal, elke gebruiker krijgt een eigen ArnoBot-account plus een managerdashboard.',
  robots: { index: true, follow: true },
}

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return children
}
