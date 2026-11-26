import { describe, expect, it } from 'vitest'
import { MAIL_CRONS, mailCronTekst } from './mailCrons'

describe('mailCrons', () => {
  it('verwijst alleen naar crons die in vercel.json staan', () => {
    for (const type of Object.keys(MAIL_CRONS)) {
      expect(mailCronTekst(type), type).not.toContain('niet in vercel.json')
    }
  })

  it('geeft geen label aan een mail die alleen na een gebeurtenis gaat', () => {
    expect(mailCronTekst('opzegging_bevestiging')).toBeNull()
  })
})
