import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { schoonVoorTelegram } from './cron-notify'

describe('schoonVoorTelegram', () => {
  it('haalt e-mailadressen, IP-adressen en profiellinks weg', () => {
    const uit = schoonVoorTelegram('jan.de-vries+x@voorbeeld.co.uk, 192.168.10.4, 2a02:a457:1::1f, 2001:0db8:85a3:0000:0000:8a2e:0370:7334 https://www.linkedin.com/in/jan')
    expect(uit).toBe('[e-mailadres], [ip], [ip], [ip] [profiellink]')
  })
  it('laat eigen adressen, tijden, bedragen, ids en links staan', () => {
    const tekst = 'Mail admin@arno.bot om 06:30:15 over €22,99, user_2abcDEF, 3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f https://www.arno.bot/bot/admin?user=user_2abc Fout: a::b is geen type'
    expect(schoonVoorTelegram(tekst.replace(' Fout: a::b is geen type', ''))).toBe(tekst.replace(' Fout: a::b is geen type', ''))
  })
})

describe('Telegram heeft een doorgang', () => {
  it('niemand verstuurt buiten lib/cron-notify.ts om', () => {
    // test-telegram stuurt een vaste testtekst en toont het antwoord van Telegram aan de beheerder.
    const toegestaan = ['lib/cron-notify.ts', 'app/api/admin/test-telegram/route.ts']
    const alle = (map: string): string[] => readdirSync(map).flatMap(n => {
      const pad = join(map, n)
      return statSync(pad).isDirectory() ? alle(pad) : /\.tsx?$/.test(n) && !/\.test\.ts$/.test(n) ? [pad] : []
    })
    const fout = [...alle('app'), ...alle('lib'), 'proxy.ts']
      .filter(p => readFileSync(p, 'utf8').includes('api.telegram.org'))
      .map(p => p.replace(/\\/g, '/'))
      .filter(p => !toegestaan.includes(p))
    expect(fout).toEqual([])
  })
})
