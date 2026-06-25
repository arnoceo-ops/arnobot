# Claude Code — project instructies

## Git
- Na elke commit direct pushen naar origin master: `git push origin master`
- Nooit alleen committen zonder te pushen — Vercel deployt alleen via GitHub

## UI-stijl — ALTIJD consistent toepassen

**Regel**: elke keer dat een UI-norm wordt vastgesteld of gewijzigd, update je CLAUDE.md in dezelfde commit. Geen uitzondering.

**Werkwijze**: bij elke nieuwe UI-component, controleer alle elementen direct tegen de vaste normen hieronder vóór commit. Niet achteraf. Bij twijfel over de juiste norm: vragen aan de gebruiker.

## Streepjes — ABSOLUUT VERBOD — for ever and ever

De tekens —, – en een losstaand koppelteken als leesteken (bijv. "hij deed het - maar") worden NOOIT gebruikt in arno.bot. Nergens. Nooit.

**Dit geldt voor:**
- UI-copy, labels, placeholders, knoppen, titels
- Q&A-teksten
- Alle systeemprompts van ArnoBot
- Alle AI-gegenereerde output: coaching, analyse, debrief, synthese, 1:1 agenda, spotlight, bieb, sparren

**Enige uitzondering:** een koppelteken IN een samengesteld woord waar het taalkundig onvermijdelijk is (MT-lid, oud-klant, follow-up). Nooit als leesteken ter vervanging van een komma of punt.

**Handhaving in systeemprompts:** elke route die AI-output genereert MOET deze zin bevatten in de systeemprompt:
`Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.`

**Als je zelf tekst schrijft of herschrijft:** vervang het streepje door een punt of komma, of herschrijf de zin. Laat het streepje nooit staan.

**Als de gebruiker zegt "haal eruit" of "verwijder":** verwijder alleen het streepje. Voeg niets terug — geen komma, geen punt, tenzij de gebruiker dat expliciet vraagt.

## Nieuwe content of functionaliteit — altijd eerst voorstellen

Bij nieuwe tekst (Q&A, copy, labels) of nieuwe functionaliteit: eerst een voorstel tonen aan de gebruiker, wachten op akkoord, dan pas bouwen. Geen uitzondering.

Bij elke nieuwe pagina of component: lees eerst een bestaande pagina door en leg de stijl naast elkaar. Nooit afwijken zonder expliciete opdracht.
- **/bot-pagina's** (achter login): referentie is `app/bot/account/page.tsx`
- **Publieke pagina's** (geen login vereist): referentie is `app/privacy/page.tsx` — nooit de voorwaardenpagina als referentie gebruiken

### Vaste normen
- **Body tekst**: Space Mono, fontWeight 400, fontSize 15px, lineHeight 1.9, kleur #9ca3af
- **Labels (amber)**: Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f59e0b — geldt voor ALLE amber labels: inline, sectiekoppen in configurators, "BEGIN HET GESPREK", etc.
- **Labels (amber, synthesetitel zoals SYNTHESE/TERUGBLIK)**: Space Mono, fontWeight 700, fontSize 13px, letterSpacing 4, kleur #f59e0b — alleen voor de titel boven een AI-syntheseblok
- **Subkoppen binnen AI-content** (bijv. KRACHT VAN HET TEAM, GROEIKANS in analyse-cards): Space Mono, fontWeight 400, fontSize 13px, letterSpacing 4, kleur #f1f5f9 — wit, niet amber. Amber is voor UI-labels die content introduceren, niet voor hiërarchie binnen AI-gegenereerde tekst.
- **H1**: Bebas Neue, fontSize 64, letterSpacing 3, kleur #f1f5f9
- **H2**: Bebas Neue, fontSize 32, letterSpacing 2, kleur #f1f5f9
- **Primaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 36px', borderRadius 999, background #f59e0b, **color #111827**, hover #d97706. Gebruik wanneer het de enige of belangrijkste actie in een sectie is.
- **Secundaire knop**: Bebas Neue 18px, letterSpacing 3, padding '12px 32px', borderRadius 999, border '1px solid #374151', color #9ca3af. Alleen gebruiken als er al een primaire knop in dezelfde context staat (bijv. Annuleren naast Opslaan).
- **Destructieve knop**: zelfde vorm als secundair maar border + color #cc2200. Voor onomkeerbare acties (verwijderen, account wissen).
- **Input/textarea**: Space Mono 15px, fontWeight 400, padding 12px 16px, borderRadius 4, border 1.5px solid #374151, focus → border #f59e0b, placeholder kleur #4b5563
- **Gedempte tekst** (artikelnummers, voetnoten, meta): #6b7280 — nooit #4b5563 buiten placeholders gebruiken
- **Container**: maxWidth 812, padding 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px'
- **Style-tag**: altijd bovenaan met font-import, `* { box-sizing: border-box; margin: 0; padding: 0; }`, body met font-weight 400
- **Achtergrond**: #111827 pagina, #1f2937 voor cards/inputs

## Gespreksstijl (ArnoBot + Bieb) — REFERENTIE is SparClient.tsx, nooit zelf afwijken
- **JIJ-label**: Bebas Neue 18px, letterSpacing 3, kleur **#6b7280**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **ARNO-label**: Bebas Neue 18px, letterSpacing 3, kleur **#f59e0b**, whiteSpace nowrap, paddingTop 2px, minWidth 48px
- **JIJ-tekst (vraag)**: Bebas Neue, fontSize clamp(18px,3vw,26px), lineHeight 1.5, kleur #f1f5f9, letterSpacing 0.5px
- **ARNO-tekst (antwoord)**: Space Mono, fontSize 15px, lineHeight 1.9, kleur #9ca3af, fontWeight 400
- **JIJ-rij achtergrond**: geen (transparant = paginakleur #111827)
- **ARNO-rij achtergrond**: #1f2937 (elevated card, AI-content)
- **Padding beide rijen**: gelijk — clamp(20px,3vw,32px) horizontaal en verticaal
- **Gap label↔tekst**: clamp(16px,3vw,40px)
- **Container breedte gesprek**: maxWidth 812px, margin 0 auto
- **Designregel**: AI-gegenereerde content = #1f2937 card. Gebruikersinput = transparant op #111827.

## Model-inventaris — controleer elk kwartaal

Elke route gebruikt een bewust gekozen model. Controleer elk kwartaal (of na een nieuwe Anthropic release) of dit nog de juiste keuzes zijn.

| Route | Model | Reden | Laatste check |
|---|---|---|---|
| `app/api/chat/route.ts` (hoofdchat) | `claude-sonnet-4-6` | Conversationele turns, hoog volume, Sonnet volstaat | 2026-06 |
| `app/api/bot/uitdaging/route.ts` | `claude-sonnet-4-6` | Één korte vraag genereren, Sonnet volstaat | 2026-06 |
| `app/api/bot/session-end/route.ts` (synthese) | `claude-haiku-4-5-20251001` | Drie snelle batch-calls per sessie, kwaliteit voldoende | 2026-06 |
| `app/api/bot/coaching/route.ts` (precheck) | `claude-sonnet-4-6` | Alleen ja/nee-vraag, Fable 5 overkill | 2026-06 |
| `app/api/bot/coaching/route.ts` (hoofdsynthese) | `claude-opus-4-8` | Fable 5 tijdelijk stopgezet. Opus 4.8 is de beste beschikbare keuze voor complexe redenering. Hercheck zodra Fable 5 weer beschikbaar is. | 2026-06 |
| `app/api/bot/coaching/route.ts` (blog-synthese) | `claude-haiku-4-5-20251001` | Korte label per blog, Haiku volstaat | 2026-06 |
| `app/api/bot/coaching-analyse/route.ts` (BIEB-analyse) | `claude-sonnet-4-6` | Patroonanalyse van max 20 gesprekken, Sonnet volstaat | 2026-06 |

**Hoe te controleren**: vraag Claude Code "check de modelinventaris in CLAUDE.md — zijn er nieuwere of betere modellen beschikbaar?"

## Foto (header in arnobot/page.tsx)
- NOOIT meer aanpassen tenzij de gebruiker er expliciet om vraagt
- Huidig formaat: `<img src="/cyborg.jpg" style={{display:'block', width:'380px', maxWidth:'100%', height:'auto'}} />` in een `subscribe-text-col` div
- Geen background-image, geen position:absolute, geen objectFit — gewoon de img tag
