'use client'
import { useState, useEffect } from 'react'

export type TeamStatus = {
  // true zodra bevestigd (niet giswerk): confirmedMember/confirmedManager mogen pas gebruikt
  // worden om iets te tonen/verbergen als loaded true is EN failed false is.
  isTeamMember: boolean
  isManager: boolean
  loaded: boolean
  failed: boolean
}

// Vervangt vijf losse, woordelijk gekopieerde fetch('/api/bot/team/status')-blokken
// (account/page.tsx, QAClient.tsx, CoachingClient.tsx, analyses/page.tsx en voorheen ook
// SparClient.tsx), die bij een mislukte fetch allemaal stil terugvielen op isTeamMember=false.
// Dat is de verkeerde kant op: een teamlid zag dan alsnog secties die voor hem verborgen
// hoorden te zijn (REFERRAL, opzeggen), of andersom miste een teamlid iets dat wel voor hem
// bedoeld was. Consumers moeten daarom altijd `loaded && !failed` checken vóór ze op
// isTeamMember/isManager afgaan, nooit alleen op de boolean zelf.
export function useTeamStatus(): TeamStatus {
  const [state, setState] = useState<TeamStatus>({ isTeamMember: false, isManager: false, loaded: false, failed: false })

  useEffect(() => {
    let cancelled = false
    fetch('/api/bot/team/status')
      .then(r => {
        if (!r.ok) throw new Error(`team/status ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (cancelled) return
        setState({ isTeamMember: !!d.hasTeam && !d.isManager, isManager: !!d.isManager, loaded: true, failed: false })
      })
      .catch(() => {
        if (cancelled) return
        setState(s => ({ ...s, loaded: true, failed: true }))
      })
    return () => { cancelled = true }
  }, [])

  return state
}
