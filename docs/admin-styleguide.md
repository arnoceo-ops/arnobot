# ArnoBot Admin — Stijlgids

Referentiedocument voor alle adminpagina's onder `/bot/admin/`. Gebruik dit bij het bouwen van nieuwe adminpagina's zodat de stijl consistent blijft.

---

## Kleuren

| Token | Hex | Gebruik |
|---|---|---|
| bg-nav | `#0d0d0d` | Navigatiebalk achtergrond |
| bg-page | `#111827` | Paginaachtergrond |
| bg-card | `#1f2937` | Cards, inputs, dropdowns |
| bg-hover | `#1e293b` | Actieve navlink achtergrond |
| border | `#374151` | Alle borders (inputs, cards, dividers) |
| amber | `#f59e0b` | Labels, actieve links, accenten |
| amber-hover | `#d97706` | Hover op amber elementen |
| text-head | `#f1f5f9` | Koppen, namen, primaire tekst |
| text-body | `#9ca3af` | Bodytekst, antwoorden |
| text-muted | `#6b7280` | Gedempte labels, metadata |
| text-dim | `#4b5563` | Zeer gedempte tekst, tijden |
| success | `#44cc88` | Successtatus |
| error | `#cc4444` | Foutstatus |
| error-hard | `#cc2200` | Destructieve acties |

---

## Navigatie

Identiek op alle adminpagina's. Niet aanpassen zonder alle pagina's mee te updaten.

```
achtergrond:  #0d0d0d
border-bottom: 1px solid #1e293b
hoogte:       56px
layout:       CSS grid, 3 kolommen (1fr auto 1fr)
padding:      0 40px
```

**Navlinks:**
- font-size: 15px, letter-spacing: 3px, font-weight: 700
- inactief: kleur `#9ca3af`, geen achtergrond
- actief: kleur `#f59e0b`, achtergrond `#1e293b`, border-radius: 4px
- padding: 6px 20px

**Volgorde links (links → rechts):** USERS · CRONS · ARNOBOT · BLOGS · META · FEEDBACK | ARNO.BLOG · UITLOGGEN

---

## Paginastructuur

```
<main> background: #111827, min-height: 100vh, font-family: sans-serif
  <nav> (zie Navigatie)
  <div> maxWidth: 800px, margin: 0 auto, padding: 48px 40px
    eyebrow label (amber, 13px, letter-spacing 4)
    <h1> (48px, font-weight 700, letter-spacing -1px)
    content
```

**Let op:** de admin gebruikt `sans-serif` (systeemfont), niet Space Mono of Bebas Neue. Dat is bewust: adminpagina's zijn functioneel, niet branded.

---

## Typografie

| Element | Spec |
|---|---|
| Bodytekst | sans-serif, 15-16px, kleur `#9ca3af`, line-height 1.7-1.8 |
| Eyebrow / label | sans-serif of monospace, 13px, letter-spacing 4, kleur `#f59e0b` |
| H1 | sans-serif, 48px, font-weight 700, letter-spacing -1px, kleur `#f1f5f9` |
| Sessionlabel | 16px, letter-spacing 2, kleur `#f59e0b`, opacity 0.7 |
| Metadata (tijd, IP) | 11-16px, opacity 0.25-0.3 |

---

## Knoppen

**Primair (submit/actie):**
- background: `#f59e0b`, color: `#000`, border: none
- padding: 10px 24px, font-weight: 700, font-size: 14px
- cursor: pointer

**Secundair / ghost:**
- background: none of `#1f2937`, border: 1px solid `#374151`
- color: `#9ca3af`

**Laadstatus:**
- background: `#374151`, color: `#6b7280`, cursor: wait

---

## Formulierelementen

**Input / select / textarea:**
- background: `#1f2937`
- border: **1.5px solid `#374151`** (let op: 1.5px, niet 1px)
- color: `#f1f5f9`
- padding: 10px 14px, font-size: 16px

**Label boven input:**
- font-size: 16px, letter-spacing: 2px, kleur: `#f59e0b`, opacity: 0.7

**Focus:**
- border-color: `#f59e0b`

---

## Statuskleuren

| Status | Kleur | Gebruik |
|---|---|---|
| Actief / betaald | `#44cc88` | Gebruikersstatus groen |
| Trial | `#f59e0b` | Amber badge |
| Verlopen / geblokkeerd | `#cc4444` | Rood badge |
| Pending / onbekend | `#6b7280` | Grijs |

---

## Datarijen en sessies

**Sessie-accordeon:**
- border-top: 2px solid `#f59e0b`
- padding-top: 20px
- margin-bottom: 56px

**Vraag (gebruiker):**
- font-weight: 700, font-size: 16px, kleur: `#f1f5f9`

**Antwoord (ArnoBot):**
- font-size: 16px, line-height: 1.8, kleur: `#9ca3af`

**Tijdstempel:**
- font-size: 11px, opacity: 0.25, margin-top: 6px

---

## Accordeons (archief/uitklap)

- Card: background `#1f2937`, border: `1px solid #374151`
- Header button: width 100%, display flex, padding 16px 20px
- Border-top bij open: `1px solid #374151`
- Content padding: 24px

---

## Inconsistenties (opgelost)

| Pagina | Probleem | Status |
|---|---|---|
| `app/bot/admin/page.tsx` | Inputborders waren `1px solid #222` | **Opgelost** (commit c351299) |

---

## Paginaverwijzingen

Elke nieuwe adminpagina vergelijken met de bestaande structuur:

- **Hoofdpagina gesprekken:** `app/bot/admin/page.tsx`
- **Gebruikersbeheer:** `app/bot/admin/gebruikers/page.tsx`
- **E-mail crons:** `app/bot/admin/emails/EmailsClient.tsx`
- **Meta-analyse:** `app/bot/admin/meta-analyse/MetaAnalyseClient.tsx`
- **Blog-ideeën:** `app/bot/admin/idee/page.tsx`
- **Evaluaties:** `app/bot/admin/evaluaties/page.tsx`
