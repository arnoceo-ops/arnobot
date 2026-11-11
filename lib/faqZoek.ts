import React from 'react'

// Zoeklogica van de FAQ-pagina (app/bot/qa/QAClient.tsx). Los van de component zodat ze testbaar is.

export const FAQ_ZOEK_MIN_TEKENS = 3
export const FAQ_ZOEK_MAX_TEKENS = 80

// Kleine letters, zonder accenten, spaties samengevouwen.
export function normaliseerZoekterm(tekst: string): string {
  return tekst
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Haalt de platte tekst uit een antwoord dat string of JSX kan zijn.
export function platteTekst(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(platteTekst).join(' ')
  if (React.isValidElement(node)) {
    return platteTekst((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

// Elk woord uit de zoekopdracht moet ergens in de vraag of het antwoord voorkomen.
export function matchtZoekopdracht(zoekterm: string, vraag: string, antwoord: React.ReactNode): boolean {
  const woorden = normaliseerZoekterm(zoekterm).split(' ').filter(w => w.length >= 2)
  if (woorden.length === 0) return true
  const haystack = normaliseerZoekterm(`${vraag} ${platteTekst(antwoord)}`)
  return woorden.every(w => haystack.includes(w))
}
