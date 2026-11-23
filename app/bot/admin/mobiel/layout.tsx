import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'ArnoBot Admin',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#111827',
}

export default function MobielLayout({ children }: { children: React.ReactNode }) {
  return children
}
