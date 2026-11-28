## Model-inventaris — controleer elke maand

Hersteld 2026-11-08 uit de code (de tabel was sinds de afslanking van 2026-08-29 weg uit CLAUDE.md, waardoor de handover-cron hem stil oversloeg). Kwaliteit gaat vóór kosten; een goedkoper model alleen als de kwaliteit voor die taak aantoonbaar gelijk is. Per route de volledige redenering: `docs/CLAUDE_HISTORY.md` en de plandocumenten.

| Route | Model | Reden | Laatste check |
|---|---|---|---|
| Hoofdchat (`app/api/chat/route.ts`, `lib/voice.ts`) | `claude-sonnet-4-6` | Sonnet 5 gaf bij lange vragen geen tekstblok (thinking zonder output). Chat gebruikt `.messages.stream(`, met retry bij leeg antwoord. | 2026-11-08 |
| Hoofdchat, geldcontrole vóór het antwoord (`lib/geldCheck.ts`) | `claude-haiku-5-5` | Haalt gegevens uit het gesprek en herkent een geldvraag; rekent en adviseert niet (de code rekent, `lib/geldTool.ts`). Met denkstap (zo gemeten). Bij elk chatbericht van een ingelogde gebruiker (sinds 27-11). | 2026-11-27 (proef via de API en test in de app) |
| Hoofdchat, antwoord op een herkende geldvraag (`app/api/chat/route.ts`) | `claude-sonnet-5-5` | Met denkstap op lage inzet en eigen denkruimte boven op de antwoordlengte (zie de eerdere afwijzing van Sonnet 5 hierboven). Niet bij een link of de documentlezer. | 2026-11-27 (proef via de API en test in de app) |
| Samenvatting van een afgerond gesprek en het gericht herstellen ervan (`lib/sessieSamenvatting.ts`) | `claude-sonnet-5-5` | Sinds 28-11 voor iedereen: Haiku 4.5 gaf een advies van ArnoBot verkeerd weer. Denkstap op lage inzet met 4000 tokens eigen ruimte. Opdracht gelijk gelaten. Terugval bij een lege uitkomst: Haiku 4.5. | 2026-11-28 (proefaanroepen en een gesprek in de app) |
| Geheugentoets op feiten en samenvatting (`lib/geheugenToets.ts`) | `claude-sonnet-4-6` | Twee aparte aanroepen: de samenvatting tegen het volledige gesprek, de feiten tegen de ingekorte bron (sinds 28-11 van ArnoBot alleen nog de vragen waarop de gebruiker antwoordt, zodat zijn meningen geen feit meer worden). De oude toets keurde in 5 van 5 rondes op een gesprek iets af en herschreef daarna ook inhoud weg, na de wijziging 0 van 5. **Open punt (bij de uitrol geaccepteerd):** een zin over een plan van de gebruiker dat alleen ArnoBot noemde wordt niet gevonden, door de oude toets ook niet (beide 0 van 3). | 2026-11-28 |
| Chat RAG-herschrijving, sessie-end, sessie-zoek, 1:1-agenda, entiteiten, labels, nudge, rss-ingest, productvragen, feedback-analyse, kennisbank-scripts, omzetting van een antwoord van een andere AI in een profiel (lib/historieImport.ts, achter HISTORIE_IMPORT_OPEN) | `claude-haiku-4-5-20251001` | Korte classificatie-, herschrijf- en extractietaken, met fallbacks. | 2026-11-08 |
| Uitdaging, coaching-hoofdsynthese, team-zelfcoaching, meta-analyse (JOUW ANALYSE), admin-analyse | `claude-fable-5-1` | Belangrijkste syntheses, hoogste kwaliteit. Opus 5 eerder getest en verworpen (`scripts/test-opus5-vs-fable5.mjs`). | 2026-11-08 |
| Coaching-analyse, spotlight, samenvatting van bewaarde documenten (`lib/documentSamenvatting.ts`), auto-analyse, openers, sparring (chat, open, debrief), precheck-routes, verfijn, LinkedIn-zoek, blogs-analyse, feitencontrole, geheugentoets, groeibalans, patroonmails, model-check | `claude-sonnet-4-6` | Lange prompts of batchwerk waar Sonnet 5 stil een leeg antwoord kon geven. | 2026-11-08 |
| Coaching-precheck in `app/api/bot/coaching/route.ts` | `claude-sonnet-5` | Alleen een ja/nee-vraag. | 2026-11-08 |
| Kennisbank-embedding (`lib/rag.ts`, rss-ingest) | `voyage-3-large` | Hele kennisbank is hiermee ge-embed; wisselen vraagt volledige her-embedding (voyage-4 onderzocht en geparkeerd). | 2026-11-08 |
| Sessiegeheugen-embedding (`embedSessionText`) | `voyage-multilingual-2` | Eén gedeelde functie voor alle schrijvers (model-mix-incident 2026-08-12). Door Voyage als deprecated gemarkeerd. | 2026-11-08 |
| Rerank kennisbank | `rerank-2.5` | Strikt beter dan rerank-2, zelfde prijs. | 2026-11-08 |
| Transcriptie (`app/api/transcribe`, live) | `gpt-transcribe`, `gpt-live-transcribe` (OpenAI) | `whisper-1` en `gpt-4o-transcribe` vervallen per 26-2-2027. | 2026-11-08 |
| Audiobijlage in de hoofdchat (`lib/assemblyai.ts`) | `universal-3-5-pro` (AssemblyAI) | Transcriptie van geüploade audio. Betaald plan (Pay as you go) sinds 2026-11-17: alleen daar kan de opt-out voor modeltraining aan (op Free staat training standaard aan en is de opt-out vergrendeld). Data Controls: opt-out aan, TTL 1 dag (vangnet naast ons eigen DELETE). Zie de privacyclaim "geen training" in `app/privacy/page.tsx`. | 2026-11-17 |
| Stem uit (`lib/voice.ts`) | `eleven_flash_v2_5` (ElevenLabs) | Lage latency voor spraakuitvoer. | 2026-11-08 |
| Offline: `scripts/translate-knowledge-base.mjs` | `claude-opus-5` | Eenmalig vertaalscript. | 2026-11-08 |

## Modelvergelijking Opus 5.5 tegen Fable 5.2 (2026-11-11)

Aanleiding: een externe sales-expert vond Opus 5.5 beter dan Fable 5.2. Blinde A/B op echte data van twee gebruikers (coaching-hoofdsynthese en dagelijkse mindsetvraag), scripts `scripts/test-opus55-vs-fable52.mjs` (zet `TEST_USER_ID` voor een andere gebruiker) en `scripts/test-meta-fable52-vs-opus55.ts` (meta-analyse met de echte productiecode, model vervangen in het verzoek).

**Gekozen:** geen modelwissel, productie blijft `claude-fable-5-1`. Ronde 1: geen duidelijke winnaar (coaching Fable 5.2 iets beter, mindsetvraag Opus 5.5 iets beter). Ronde 2 en de meta-analyse: niet afgerond. **Verworpen:** nu wisselen, want geen aantoonbare kwaliteitswinst en de technische voorwaarden ontbreken.

**Technische voorwaarde voor elke wissel naar Fable 5.2 of Opus 5.5:** beide denken standaard eerst, en die denktokens tellen mee in `max_tokens`. Gevolg in de test: afgekapte of lege antwoorden bij een te lage limiet. In `lib/metaAnalyse.ts` kapte de zelfbeoordeling met Fable 5.2 af op 12000 tokens, en de retry met meer ruimte crashte omdat de SDK bij zo'n grote limiet streaming eist (`messages.create` moet `.messages.stream(...).finalMessage()` worden). Eerst dit rechtzetten in de Fable-routes, dan pas testen en wisselen.

**Volgende test:** bij de eerstvolgende modelcontrole (cron `model-check`, elke 1e van de maand, volgende 2026-12-01) of de kwartaalcheck van januari, als daar een nieuw model uit komt. Dan Opus 5.5 en Fable 5.2 opnieuw meenemen, inclusief de meta-analyse.

## Actiepunten leveranciers (gevonden bij de Abacus-controle van 2026-11-28)

Gelezen door een controle-agent op 2026-11-28 op de pagina's van de leveranciers, niet apart nagelezen. Eerst zelf op de bron controleren voor je iets wijzigt.

| Leverancier | Wat | Wie | Bron |
|---|---|---|---|
| Voyage | `rerank-2.5` staat als Legacy, uit gebruik per 1-9-2027 (vervanger `rerank-3`, zelfde prijs). `voyage-3-large` uit gebruik per 1-12-2027 (vervanger `voyage-4-large`, raakt de hele kennisbank). De pagina zegt alleen over `ai.mongodb.com` te gaan: nog niet vastgesteld of dit voor api.voyageai.com geldt. | Uitzoeken | https://www.mongodb.com/docs/voyageai/models/lifecycle/ |
| AssemblyAI | `universal-3-5-pro` sinds 17-11-2026 deprecated, geen einddatum (vervanger `assemblyai-stt-3-7`, zelfde prijs). Sprekersherkenning is bij dit model mogelijk duurder ($0,065 in plaats van $0,02 per uur). | Arno: factuur nakijken | https://www.assemblyai.com/docs/getting-started/model-versions-and-deprecations en /pricing |
| ElevenLabs | De prijspagina's noemen voor Flash minder credits per teken (0,5) of $0,04 per 1.000 tekens, en spreken elkaar tegen. Abacus rekent 1,0, `lib/maandKosten.ts` $0,166 per 1.000. Bij een nieuw tarief grijpt de kostenrem op spraak te vroeg in. | Arno: in het account kijken welk tarief geldt | https://elevenlabs.io/pricing en /pricing/api |
| Anthropic | `claude-haiku-4-5-20251001`: vroegste einddatum "niet voor 15-10-2026" is voorbij, opzegtermijn minimaal 60 dagen. Geen aankondiging gezien. | Maandcheck | https://platform.claude.com/docs/en/about-claude/model-deprecations |

Ook open: `lib/maandKosten.ts` (kostenrem per gebruiker, buiten Abacus) rekent elke beurt met bijlage tegen Sonnet 4.6, ook als Sonnet 5.5 antwoordde. De embeddings van Voyage hebben in `lib/externGebruik.ts` nog geen prijs ($0,18 en $0,12 per miljoen tokens volgens docs.voyageai.com/docs/pricing).
