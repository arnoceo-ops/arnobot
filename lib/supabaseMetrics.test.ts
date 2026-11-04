import { describe, it, expect } from 'vitest'
import { leesWaarde, parseServerMeting } from './supabaseMetrics'

const VOORBEELD = [
  'node_memory_Cached_bytes{supabase_project_ref="x",service_type="db"} 5.08104704e+08',
  'node_memory_MemTotal_bytes{supabase_project_ref="x",service_type="db"} 9.48191232e+08',
  'node_memory_MemAvailable_bytes{supabase_project_ref="x",service_type="db"} 5.64527104e+08',
].join('\n')

describe('supabaseMetrics', () => {
  it('leest een waarde met labels en wetenschappelijke notatie', () => {
    expect(leesWaarde(VOORBEELD, 'node_memory_MemTotal_bytes')).toBe(948191232)
  })
  it('rekent het gebruikte geheugen uit (gemeten op Micro: ongeveer 40%)', () => {
    const { geheugenGebruikt } = parseServerMeting(VOORBEELD)
    expect(geheugenGebruikt).toBeCloseTo(0.4046, 3)
  })
  it('geeft null bij ontbrekende of lege gegevens', () => {
    expect(parseServerMeting('').geheugenGebruikt).toBeNull()
    expect(parseServerMeting('node_memory_MemTotal_bytes 0\nnode_memory_MemAvailable_bytes 0').geheugenGebruikt).toBeNull()
  })
})
