# Folder en landingpagina's: plan

**Laatst bijgewerkt:** 2026-11-24
**Waar we staan:** SQL (`docs/sql/2026-11-24-bron-attributie.sql`) is door Arno gedraaid. `/start` (opmaak afgeleid van de hoofdpagina) en het meeschrijven van `bron` (pageview, klik, aanmelding) staan in code en op master, nog niet op echte scans getest. De solo-folder bestaat in twee varianten als drukklaar PDF (A5 plus 3 mm afloop, QR als vector). Arno was bij Drukwerkdeal aan het configureren en stopt daar; nog niets besteld.
**Eerstvolgende stap (voor Arno):** bij Drukwerkdeal verder met formaat A5, 4/4 kleuren, 400 g/m², oplage 100, en de aanleverspecificaties voor de spot-UV-laag zoeken en aan Claude geven, die er dan een UV-laag van maakt. Nog niets bestellen vóór een proefdruk of staal is geregeld. Daarnaast: `/start?bron=test-folder` testen in productie, de QR met een telefoon scannen, en controleren of `/privacy` de bron-cookie (`arnobot_bron`, 30 dagen) moet noemen.

## Doel
Een hard kartonnen A5-folder om uit te delen aan mensen die Arno tegenkomt, met een QR-code naar een eigen landingpagina met aanmelding voor de 30 dagen gratis proef.

## Besluiten
- **Eén CTA op de landing: 30 dagen gratis.** Verworpen: een tweede knop "demo aanvragen", want dat verlaagt het aantal kliks op de hoofdknop, maakt de meting troebel en een demo van de teammodule heeft pas zin als de teambaas ArnoBot zelf heeft ervaren.
- **Demo via een mail na aanmelding**, op een gedragsmoment (bijvoorbeeld na het derde gesprek), met één link naar Arno's agenda. Teambaas herkennen uit het profiel in de app (kan pas als hij een team heeft gemaakt) en via de bron (`folder-team`).
- **Geen teamproef** anders dan na overleg en na een demo. Een teambaas via de folder krijgt dus een gewone solo-proef van 30 dagen. Verworpen: de teammodule direct in de proef, zoals bij een agentlink (`sd`).
- **Eerste test: één QR, die van Arno zelf**, zonder `sd`. Agent-QR's (`/start/team?sd=<token>`) komen later, de bestaande `sd`-route wordt dan hergebruikt. Een folder van een gestopte agent blijft in omloop; intrekken kan alleen door de env-var te wisselen (geaccepteerd).
- **Parameternaam `bron`, niet `ref`.** `ref` is het referralprogramma (cookie `arnobot_ref`), `?ref=folder` zou als referralcode worden behandeld.
- **Beide solo-varianten wijzen naar `/start?bron=folder-solo`.** Gekozen: één gedeelde bron, Arno hoeft geen verschil te zien tussen de varianten. Verworpen: `folder-solo-win` en `folder-solo-beton`, want dat zou alleen nodig zijn om te zien welke zin wint.
- **Twee varianten van de voorkant, beide laten drukken of kiezen:** slotregel "WIN DE DEAL, voordat de klant stilvalt." (standaard) en "GIET DE DEAL IN BETON, voordat de klant stilvalt." (`--variant=beton`). Claude's voorkeur: beton.
- **Ontwerp van de solo-folder:** voorkant is een gesprek (JIJ en ARNOBOT), achterkant heeft kop "Sluit meer deals met een coach die je uitdaagt", vier punten, QR en "Scan en start 30 dagen gratis". De landing heeft dezelfde kop. Het ArnoBot-antwoord is Arno's eigen formulering. Alle gesprekstekst is verzonnen illustratie, geen echte gebruikersdata.
- **Amber alleen op drie plekken** (voor spot-UV en focus): voorkant de eerste slotregel, achterkant "JE UITDAAGT" en "30 DAGEN GRATIS". Alles anders is wit of grijs, ook het logo. Verworpen: amber op logo, labels en kopjes.
- **Drukwerk (Drukwerkdeal, nog niet besteld):** materiaal Houtvrij mat mc, 400 g/m², afwerking dubbelzijdig matlaminaat plus spot UV-lak. Verworpen: glanzend gesatineerd (spot-UV valt dan weg), ongestreken offset en natuurkarton (UV hecht slecht), soft touch (duur), cold foil (alleen goud of zilver en maar één kant).
- **Spot-UV komt op één zijde, de voorkant,** want Drukwerkdeal biedt maximaal 30 procent van het oppervlak op één zijde. Verworpen: de achterkant (minder "wow" bij het overhandigen).

## Af te stemmen of uit te zoeken
- Aanleverspecificaties van Drukwerkdeal voor de UV-laag (aparte pagina of laag, kleur). Pas daarna de UV-laag maken.
- Matlaminaat maakt kleuren "iets fletser" (zegt Drukwerkdeal zelf). Na de proefdruk bepalen of het amber in het ontwerp feller moet.
- RGB of CMYK: het PDF is RGB. Vragen of Drukwerkdeal een CMYK- of PDF/X-versie wil.
- Of de proef (30 dagen gratis) voor iedereen geldt, zoals de folder belooft.
- Teamfolder en `/start/team`: nog niet ontworpen. Hoe de teambaas-landing de belofte formuleert, nu er geen teamproef is.
- Of de app zelf ook van label ARNO naar ARNOBOT moet in gesprekken (de folder gebruikt ARNOBOT, de app niet).

## Bouwplan
- [x] Landing `/start` (solo), één knop, geen menu (`app/start/page.tsx`, noindex)
- [x] Bronmeting: kolom `bron` op `arnobot_pageviews`, `arnobot_cta_clicks` en `approved_users` (SQL gedraaid), cookie `arnobot_bron` via `PageviewTracker`, validatie in `lib/bron.ts`
- [x] QR als vector (SVG), `qrcode` als devDependency
- [x] Folder solo als PDF, twee varianten: `node scripts/render-folder-pdf.mjs --preview [--variant=beton]` maakt `docs/folder/ArnoBot-A5-solo.pdf` en `-beton.pdf` (plus previews)
- [ ] UV-laag (aparte pagina of laag) volgens aanleverspecificaties Drukwerkdeal
- [ ] Testen in productie met een testbron en QR scannen met een telefoon
- [ ] Proefdruk of staal, daarna bestellen (oplage 100)
- [ ] Uitsplitsing per bron in admin-stats (scans, kliks, aanmeldingen)
- [ ] Landing `/start/team`
- [ ] Folder team
- [ ] Demo-mail op gedragsmoment
- [ ] `docs/ARNOBOT_OVERZICHT.md` bijwerken bij oplevering van de landingpagina's
