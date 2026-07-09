Verwerk een meta-analyse uitslag naar concrete verbeteringen in de ArnoBot systeemprompt.

## Werkwijze

De gebruiker plakt de volledige meta-analyse tekst als argument (`$ARGUMENTS`). Als er geen argument is, vraag dan om de tekst.

### Stap 1 — Lees de huidige systeemprompt

Lees `app/api/chat/route.ts` volledig. Identificeer de `systemPrompt` string. Noteer welke gedragsregels er al in staan zodat je geen duplicaten toevoegt.

### Stap 2 — Extraheer de top-3 regels

Analyseer de meta-analyse op de volgende manier:
- Lees alle "Kritisch punt:" secties van het expertpanel
- Lees de "WAT IK ZOU VERBETEREN" sectie van Arno's zelfbeoordeling
- Lees de PANEL CONSENSUS en PRIORITEIT 1
- Filter eruit wat al impliciet of expliciet in de systeemprompt zit
- Kies de **3 meest impactvolle, concrete en direct implementeerbare** verbeteringen
- Vertaal elk kritisch punt naar een gedragsregel die ArnoBot direct kan volgen (geen abstracties, geen "probeer", maar "doe X wanneer Y")

Schrijf de 3 regels op en leg per regel uit waarom je die kiest boven de andere.

### Stap 3 — Vraag goedkeuring

Toon de 3 voorgestelde regels aan de gebruiker. Wacht op akkoord. De gebruiker kan een regel schrappen, aanpassen of toevoegen. Ga niet verder zonder goedkeuring.

### Stap 4 — Pas de systeemprompt aan

Voeg de goedgekeurde regels toe aan de systeemprompt in `app/api/chat/route.ts`. Gebruik dit format:

```
// [META DATUM] — regel toegevoegd op basis van kwartaalanalyse
Regel die ArnoBot moet volgen.
```

Voeg de regels toe als een logisch blok, op een plek in de systeemprompt die past bij de aard van de regel (gedragsafspraken bij gedragsregels, toonregels bij toonregels, etc.). Niet willekeurig onderaan plakken.

### Stap 5 — Log de versie in CLAUDE.md

Voeg een entry toe aan CLAUDE.md onder een sectie `## Systeemprompt changelog`. Als die sectie nog niet bestaat, maak hem aan direct voor de Model-inventaris sectie. Format:

```
### [datum] — Meta-analyse verwerkt
- Regel 1 (kort)
- Regel 2 (kort)
- Regel 3 (kort)
Overall score panel: X/10
```

### Stap 6 — Commit en push

Commit beide bestanden (`app/api/chat/route.ts` en `CLAUDE.md`) met message:
`feat: systeemprompt update op basis van meta-analyse [datum]`

Push naar origin master.

## Kwaliteitseisen voor de regels

Een goede regel:
- Is gedragsspecifiek: "doe X wanneer Y" — niet "wees bewuster van Z"
- Past bij de toon van ArnoBot (direct, geen coachtaal)
- Is niet al aanwezig in de systeemprompt
- Lost een patroon op dat meerdere keren terugkwam, niet een eenmalig incident

Een slechte regel:
- Is vaag ("wees korter")
- Is een herhaling van wat er al staat
- Is te breed om na te leven in een specifiek gesprek
