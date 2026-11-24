# Folder en landingpagina's: plan

**Laatst bijgewerkt:** 2026-11-24
**Waar we staan:** SQL (`docs/sql/2026-11-24-bron-attributie.sql`) is door Arno gedraaid. `/start` en het meeschrijven van `bron` (pageview, klik, aanmelding) staan in code, nog niet op echte QR-scans getest. Folder en teamlanding nog niet gebouwd.
**Eerstvolgende stap:** in productie testen: open `/start?bron=test-folder`, klik, controleer in Supabase dat `bron` in `arnobot_pageviews` en `arnobot_cta_clicks` staat. Daarna uitsplitsing per bron in admin-stats, dan de folder. Controleer ook of `/privacy` de bron-cookie (`arnobot_bron`, 30 dagen) moet noemen, net als `arnobot_ref`.

## Doel
Een hard kartonnen A5-folder om uit te delen aan mensen die Arno tegenkomt, met een QR-code naar een eigen landingpagina met aanmelding voor de 30 dagen gratis proef.

## Besluiten
- **Eén CTA op de landing: 30 dagen gratis.** Verworpen: een tweede knop "demo aanvragen", want dat verlaagt het aantal kliks op de hoofdknop, maakt de meting troebel en een demo van de teammodule heeft pas zin als de teambaas ArnoBot zelf heeft ervaren.
- **Demo via een mail na aanmelding**, op een gedragsmoment (bijvoorbeeld na het derde gesprek), met één link naar Arno's agenda. Teambaas herkennen uit het profiel in de app (kan pas als hij een team heeft gemaakt) en via de bron (`folder-team`).
- **Geen teamproef** anders dan na overleg en na een demo. Een teambaas via de folder krijgt dus een gewone solo-proef van 30 dagen. Verworpen: de teammodule direct in de proef, zoals bij een agentlink (`sd`).
- **Eerste test: één QR, die van Arno zelf**, zonder `sd`. Agent-QR's (`/start/team?sd=<token>`) komen later, de bestaande `sd`-route wordt dan hergebruikt. Een folder van een gestopte agent blijft in omloop; intrekken kan alleen door de env-var te wisselen (geaccepteerd).
- **Twee ontwerpen:** een solo-A5 en een aparte opmaak voor teambazen, met elk een eigen QR en landing (`/start`, `/start/team`).
- **Parameternaam `bron`, niet `ref`.** `ref` is het referralprogramma (cookie `arnobot_ref`, zie `app/aanmelden/page.tsx`), `?ref=folder` zou als referralcode worden behandeld.

## Af te stemmen of uit te zoeken
- Drukker en specs (kartondikte, afloop, hoeken): nog niet gekozen, niet gokken.
- Of de proef (30 dagen gratis) voor iedereen geldt, zoals de folder belooft.
- Teksten solo en team: concept staat in het gesprek van 2026-11-24, Arno moet ze nog goedkeuren. Geen prijzen in de folder.
- Hoe de teambaas-landing de belofte formuleert, nu er geen teamproef is.

## Bouwplan
- [x] Landing `/start` (solo), één knop, geen menu (`app/start/page.tsx`, noindex)
- [x] Bronmeting: kolom `bron` op `arnobot_pageviews`, `arnobot_cta_clicks` en `approved_users` (SQL gedraaid), cookie `arnobot_bron` via `PageviewTracker`, validatie in `lib/bron.ts`
- [ ] Uitsplitsing per bron in admin-stats (scans, kliks, aanmeldingen)
- [ ] Testen in productie met een testbron
- [ ] Landing `/start/team`
- [ ] QR als vector (SVG), kleine bibliotheek toevoegen
- [ ] Folder solo, A5 met 3 mm afloop, via de PDF-pijplijn (puppeteer, Bebas Neue, Space Mono, amber `#f59e0b`)
- [ ] Folder team
- [ ] Demo-mail op gedragsmoment
- [ ] `docs/ARNOBOT_OVERZICHT.md` bijwerken bij oplevering van de landingpagina's
