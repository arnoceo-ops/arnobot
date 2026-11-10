import { describe, expect, it } from 'vitest'
import robots from './robots'

type Regel = { userAgent?: string | string[]; allow?: string | string[] }

function regelVoor(agent: string): Regel {
  const regels = robots().rules as Regel[]
  const r = regels.find(x => (Array.isArray(x.userAgent) ? x.userAgent : [x.userAgent]).includes(agent))
  if (!r) throw new Error(`geen regel voor ${agent}`)
  return r
}

const allow = (r: Regel) => (Array.isArray(r.allow) ? r.allow : [r.allow])

describe('robots /gesprek/', () => {
  it('AI-crawlers mogen gedeelde gesprekken niet lezen', () => {
    for (const a of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'CCBot']) {
      expect(allow(regelVoor(a))).not.toContain('/gesprek/')
    }
  })

  it('zoekmachines en linkpreview-bots mogen wel crawlen (zodat noindex en preview werken)', () => {
    expect(allow(regelVoor('*'))).toContain('/gesprek/')
    for (const a of ['LinkedInBot', 'WhatsApp', 'Slackbot']) {
      expect(allow(regelVoor(a))).toContain('/gesprek/')
    }
  })
})
