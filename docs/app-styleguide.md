# ArnoBot App — Stijlgids

Referentiedocument voor alle app-pagina's (zowel publiek als achter login). Gebruik dit bij het bouwen van nieuwe pagina's.

**Referentiepagina's:**
- `/bot`-pagina's (achter login): `app/bot/account/page.tsx`
- Publieke pagina's: `app/privacy/page.tsx`
- Gespreksstijl: `app/bot/SparClient.tsx`

---

## Kleuren

| Token | Hex | Gebruik |
|---|---|---|
| bg-page | `#111827` | Paginaachtergrond |
| bg-card | `#1f2937` | Cards, inputs, AI-content |
| bg-hover | `#1e293b` | Hover op navigatie-items |
| border | `#374151` | Alle borders |
| amber | `#f59e0b` | Labels, knoppen, accenten |
| amber-hover | `#d97706` | Hover op amber elementen |
| text-head | `#f1f5f9` | H1, H2, primaire tekst |
| text-body | `#9ca3af` | Bodytekst, ARNO-antwoorden |
| text-muted | `#6b7280` | Gedempte links, metadata |
| text-dim | `#4b5563` | Placeholders in inputs |
| error-hard | `#cc2200` | Destructieve acties |

---

## Typografie

### Display (Bebas Neue)

| Element | Spec |
|---|---|
| H1 | Bebas Neue, 64px, letter-spacing 3, kleur `#f1f5f9` |
| H2 | Bebas Neue, 32px, letter-spacing 2, kleur `#f1f5f9` |
| Knoptekst | Bebas Neue, 18px, letter-spacing 3 |
| JIJ-label in gesprek | Bebas Neue, 18px, letter-spacing 3, kleur `#6b7280` |
| ARNO-label in gesprek | Bebas Neue, 18px, letter-spacing 3, kleur `#f59e0b` |
| JIJ-vraagtekst | Bebas Neue, clamp(18px,3vw,26px), line-height 1.5, kleur `#f1f5f9`, letter-spacing 0.5px |

### Mono (Space Mono)

| Element | Spec |
|---|---|
| Bodytekst | Space Mono, 15px, font-weight 400, line-height 1.9, kleur `#9ca3af` |
| Amber labels | Space Mono, 13px, font-weight 400, letter-spacing 4, kleur `#f59e0b` |
| Subkoppen in AI-content | Space Mono, 13px, font-weight 400, letter-spacing 4, kleur `#f1f5f9` (wit, niet amber) |
| ARNO-antwoordtekst | Space Mono, 15px, font-weight 400, line-height 1.9, kleur `#9ca3af` |
| Secundaire links | Space Mono, 13px, letter-spacing 4, kleur `#6b7280`, geen underline |
| Gedempte tekst | Space Mono, kleur `#6b7280` |
| Input/textarea tekst | Space Mono, 15px, font-weight 400 |

**Onderscheid amber labels vs. subkoppen in AI-content:**
- Amber (`#f59e0b`) is voor UI-labels die content introduceren (SYNTHESE, TERUGBLIK, BEGIN HET GESPREK)
- Wit (`#f1f5f9`) is voor hiërarchie binnen AI-gegenereerde tekst (KRACHT VAN HET TEAM, GROEIKANS)

---

## Container

```
maxWidth: 812px
margin: 0 auto
padding: clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px
```

---

## Knoppen

**Primair:**
- Bebas Neue 18px, letter-spacing 3
- padding: 12px 36px, border-radius: 999px
- background: `#f59e0b`, color: `#111827`
- hover: background `#d97706`
- Gebruik: de enige of belangrijkste actie in een sectie

**Secundair:**
- Bebas Neue 18px, letter-spacing 3
- padding: 12px 32px, border-radius: 999px
- border: 1px solid `#374151`, color: `#9ca3af`
- Gebruik: alleen naast een primaire knop (bijv. Annuleren)

**Destructief:**
- Zelfde vorm als secundair
- border + color: `#cc2200`
- Gebruik: onomkeerbare acties (verwijderen, account wissen)

---

## Inputs en textarea

```
font-family: Space Mono, 15px, font-weight 400
padding: 12px 16px
border-radius: 4px
border: 1.5px solid #374151
background: #1f2937
color: #f1f5f9
placeholder color: #4b5563
focus: border-color #f59e0b
```

---

## Gespreksstijl (ArnoBot en Bieb)

Referentie: `app/bot/SparClient.tsx`

### Labels

| Label | Font | Kleur |
|---|---|---|
| JIJ | Bebas Neue 18px, letter-spacing 3 | `#6b7280` |
| ARNO | Bebas Neue 18px, letter-spacing 3 | `#f59e0b` |

### Tekst

| Rij | Font | Kleur |
|---|---|---|
| JIJ-vraag | Bebas Neue, clamp(18px,3vw,26px), line-height 1.5, letter-spacing 0.5px | `#f1f5f9` |
| ARNO-antwoord | Space Mono, 15px, line-height 1.9, font-weight 400 | `#9ca3af` |

### Layout

| Element | Waarde |
|---|---|
| JIJ-rij achtergrond | transparant (`#111827`) |
| ARNO-rij achtergrond | `#1f2937` (elevated card) |
| Padding beide rijen | clamp(20px,3vw,32px) horizontaal en verticaal |
| Gap label naar tekst | clamp(16px,3vw,40px) |
| Container breedte | maxWidth 812px, margin 0 auto |

**Designregel:** AI-gegenereerde content = `#1f2937` card. Gebruikersinput = transparant op `#111827`.

---

## Style-tag structuur

Altijd bovenaan een pagina:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-weight: 400; }
```

Met Google Fonts import voor Bebas Neue en Space Mono.

---

## Absolute regels

### Geen streepjes
`—`, `–` en een losstaand koppelteken als leesteken zijn verboden. In alle UI-copy, labels, en AI-output. Enige uitzondering: koppelteken IN een samengesteld woord (MT-lid, follow-up).

**In elke systeemprompt van een AI-route:**
```
Gebruik NOOIT een streepje als leesteken (—, –, of een losstaand koppelteken). Herschrijf zinnen zonder streepjes.
```

### Geen markdown in AI-output
```
Gebruik NOOIT markdown-opmaak zoals **tekst** of *tekst*. Schrijf platte tekst.
```

### Geen tijdsdruk in AI-output
```
Schrijf de actie zonder tijdslimiet: geen "vandaag", "morgen", "deze week", "voor het weekend". Gewoon de actie zelf.
```

### Loading state verplicht
Elke fetch naar een AI-route heeft een zichtbare loading-indicator. Gebruik `.msg-loading` + `.loading-dots` + `.loading-text` structuur (zie SparClient.tsx).

---

## Paginaverwijzingen

| Type | Referentiepagina |
|---|---|
| /bot-pagina's (achter login) | `app/bot/account/page.tsx` |
| Publieke pagina's | `app/privacy/page.tsx` |
| Gespreksstijl | `app/bot/SparClient.tsx` |
