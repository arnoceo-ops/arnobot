'use client'

import React from 'react'
import Link from 'next/link'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

// Voor links die in de Android-app niet in de app zelf mogen openen: daar is geen browserbalk, dus
// geen zichtbare weg terug, en een PDF hoort in een echte browser. In de app opent de link in een
// browservenster boven de app (sluiten met het kruisje of de terugknop). In een gewone browser is
// dit een normale link.
type Props = { href: string; children: React.ReactNode; style?: React.CSSProperties }

export default function AppVensterLink({ href, children, style }: Props) {
  function open(e: React.MouseEvent) {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Browser')) return
    e.preventDefault()
    Browser.open({ url: new URL(href, window.location.origin).href, toolbarColor: '#111827' })
  }

  if (href.endsWith('.pdf')) {
    return <a href={href} target="_blank" rel="noopener noreferrer" onClick={open} style={style}>{children}</a>
  }
  return <Link href={href} onClick={open} style={style}>{children}</Link>
}
