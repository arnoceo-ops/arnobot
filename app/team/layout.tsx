import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ArnoBot: Team voor je hele team',
  description: 'Vraag ArnoBot Team aan voor je team: meerdere gebruikers onder één deal, elke gebruiker krijgt een eigen ArnoBot-account plus een managerdashboard.',
  robots: { index: true, follow: true },
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children
}
