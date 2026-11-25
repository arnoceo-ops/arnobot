// Alle stippen van de admin-app, opgehaald met dezelfde functies als de pagina zelf (/bot/admin/mobiel).
// Namen van gebruikers en teams komen bewust niet in de teksten: die staan op het vergrendelscherm.
// Een kaart die niet te laden is, levert geen stip op en laat de vorige stand dus staan.
import { haalGeld, haalGebruikers, haalPatronen, haalStatus, haalTeams, haalTeBeoordelen, veilig } from '@/lib/adminMobielData'
import { heeftVerseAanvraag, niveauOmzet, niveauTeBeoordelen, niveauTeamsKaart } from '@/lib/adminMobielLogica'
import type { Stip } from '@/lib/adminStippen'

const aantal = (n: number, enkel: string, meer: string) => `${n} ${n === 1 ? enkel : meer}`

export async function haalStippen(nu: Date, eigenCron: string): Promise<Stip[]> {
  const gebruikers = await veilig('gebruikers', () => haalGebruikers(nu))
  const namen = gebruikers.ok ? gebruikers.data.namen : new Map<string, string>()
  const [status, beoordelen, patronen, geld, teams] = await Promise.all([
    veilig('status', () => haalStatus(0, nu, { zonderCron: eigenCron })),
    gebruikers.ok ? veilig('te beoordelen', () => haalTeBeoordelen(namen, gebruikers.data.rijen, nu)) : Promise.resolve({ ok: false as const }),
    veilig('patronen', () => haalPatronen(nu)),
    veilig('geld', () => haalGeld(namen, nu)),
    veilig('teams', () => haalTeams(nu)),
  ])

  const stippen: Stip[] = []

  if (status.ok) {
    for (const r of status.data.regels) {
      stippen.push({ sleutel: `status:${r.label}`, naam: r.label, niveau: r.niveau, tekst: r.waarde, meldBijOranje: r.meldBijOranje })
    }
  }

  if (beoordelen.ok && patronen.ok) {
    const b = beoordelen.data
    const n = b.offtopic.length + b.duimpjes.length + b.bel.length + patronen.data.filter(p => p.tweeWekenOpRij).length
    stippen.push({ sleutel: 'beoordelen', naam: 'Te beoordelen', niveau: niveauTeBeoordelen(n), tekst: n === 0 ? 'Niets te beoordelen' : aantal(n, 'punt', 'punten') })
  }

  if (geld.ok) {
    const { mislukt, openTeamFacturen } = geld.data
    const delen = [
      mislukt.length ? aantal(mislukt.length, 'mislukte betaling', 'mislukte betalingen') : '',
      openTeamFacturen.length ? aantal(openTeamFacturen.length, 'open teamfactuur', 'open teamfacturen') : '',
    ].filter(Boolean)
    stippen.push({ sleutel: 'omzet', naam: 'Omzet', niveau: niveauOmzet(mislukt.length, openTeamFacturen.length), tekst: delen.join(', ') || 'Geen open of mislukte betalingen' })
  }

  if (teams.ok) {
    const n = teams.data.teams.filter(t => t.niveau !== 'ok').length
    stippen.push({ sleutel: 'teams', naam: 'Teams', niveau: niveauTeamsKaart(teams.data.teams), tekst: n === 0 ? 'Geen team vraagt aandacht' : aantal(n, 'team vraagt aandacht', 'teams vragen aandacht') })
    const vers = heeftVerseAanvraag(teams.data.aanvragen, nu)
    stippen.push({ sleutel: 'teamaanvraag', naam: 'Teamaanvraag', niveau: vers ? 'let-op' : 'ok', tekst: vers ? 'Nieuwe aanvraag in de afgelopen 7 dagen' : 'Geen recente aanvraag' })
  }

  return stippen
}
