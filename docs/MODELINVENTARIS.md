## Model-inventaris — controleer elke maand

Hersteld 2026-11-08 uit de code (de tabel was sinds de afslanking van 2026-08-29 weg uit CLAUDE.md, waardoor de handover-cron hem stil oversloeg). Kwaliteit gaat vóór kosten; een goedkoper model alleen als de kwaliteit voor die taak aantoonbaar gelijk is. Per route de volledige redenering: `docs/CLAUDE_HISTORY.md` en de plandocumenten.

| Route | Model | Reden | Laatste check |
|---|---|---|---|
| Hoofdchat (`app/api/chat/route.ts`, `lib/voice.ts`) | `claude-sonnet-4-6` | Sonnet 5 gaf bij lange vragen geen tekstblok (thinking zonder output). Chat gebruikt `.messages.stream(`, met retry bij leeg antwoord. | 2026-11-08 |
| Chat RAG-herschrijving, sessie-end, sessie-zoek, 1:1-agenda, entiteiten, labels, sessiesamenvatting, nudge, rss-ingest, productvragen, feedback-analyse, kennisbank-scripts | `claude-haiku-4-5-20251001` | Korte classificatie-, herschrijf- en extractietaken, met fallbacks. | 2026-11-08 |
| Uitdaging, coaching-hoofdsynthese, team-zelfcoaching, meta-analyse (JOUW ANALYSE), admin-analyse | `claude-fable-5-1` | Belangrijkste syntheses, hoogste kwaliteit. Opus 5 eerder getest en verworpen (`scripts/test-opus5-vs-fable5.mjs`). | 2026-11-08 |
| Coaching-analyse, spotlight, auto-analyse, openers, sparring (chat, open, debrief), precheck-routes, verfijn, LinkedIn-zoek, blogs-analyse, feitencontrole, geheugentoets, groeibalans, patroonmails, model-check | `claude-sonnet-4-6` | Lange prompts of batchwerk waar Sonnet 5 stil een leeg antwoord kon geven. | 2026-11-08 |
| Coaching-precheck in `app/api/bot/coaching/route.ts` | `claude-sonnet-5` | Alleen een ja/nee-vraag. | 2026-11-08 |
| Kennisbank-embedding (`lib/rag.ts`, rss-ingest) | `voyage-3-large` | Hele kennisbank is hiermee ge-embed; wisselen vraagt volledige her-embedding (voyage-4 onderzocht en geparkeerd). | 2026-11-08 |
| Sessiegeheugen-embedding (`embedSessionText`) | `voyage-multilingual-2` | Eén gedeelde functie voor alle schrijvers (model-mix-incident 2026-08-12). Door Voyage als deprecated gemarkeerd. | 2026-11-08 |
| Rerank kennisbank | `rerank-2.5` | Strikt beter dan rerank-2, zelfde prijs. | 2026-11-08 |
| Transcriptie (`app/api/transcribe`, live) | `gpt-transcribe`, `gpt-live-transcribe` (OpenAI) | `whisper-1` en `gpt-4o-transcribe` vervallen per 26-2-2027. | 2026-11-08 |
| Audiobijlage in de hoofdchat (`lib/assemblyai.ts`) | `universal-3-5-pro` (AssemblyAI) | Transcriptie van geüploade audio. | 2026-11-08 |
| Stem uit (`lib/voice.ts`) | `eleven_flash_v2_5` (ElevenLabs) | Lage latency voor spraakuitvoer. | 2026-11-08 |
| Offline: `scripts/translate-knowledge-base.mjs` | `claude-opus-5` | Eenmalig vertaalscript. | 2026-11-08 |

## Modelvergelijking Opus 5.5 tegen Fable 5.2 (2026-11-11)

Aanleiding: een externe sales-expert vond Opus 5.5 beter dan Fable 5.2. Blinde A/B op echte data van twee gebruikers (coaching-hoofdsynthese en dagelijkse mindsetvraag), scripts `scripts/test-opus55-vs-fable52.mjs` (zet `TEST_USER_ID` voor een andere gebruiker) en `scripts/test-meta-fable52-vs-opus55.ts` (meta-analyse met de echte productiecode, model vervangen in het verzoek).

**Gekozen:** geen modelwissel, productie blijft `claude-fable-5-1`. Ronde 1: geen duidelijke winnaar (coaching Fable 5.2 iets beter, mindsetvraag Opus 5.5 iets beter). Ronde 2 en de meta-analyse: niet afgerond. **Verworpen:** nu wisselen, want geen aantoonbare kwaliteitswinst en de technische voorwaarden ontbreken.

**Technische voorwaarde voor elke wissel naar Fable 5.2 of Opus 5.5:** beide denken standaard eerst, en die denktokens tellen mee in `max_tokens`. Gevolg in de test: afgekapte of lege antwoorden bij een te lage limiet. In `lib/metaAnalyse.ts` kapte de zelfbeoordeling met Fable 5.2 af op 12000 tokens, en de retry met meer ruimte crashte omdat de SDK bij zo'n grote limiet streaming eist (`messages.create` moet `.messages.stream(...).finalMessage()` worden). Eerst dit rechtzetten in de Fable-routes, dan pas testen en wisselen.

**Volgende test:** bij de eerstvolgende modelcontrole (cron `model-check`, elke 1e van de maand, volgende 2026-12-01) of de kwartaalcheck van januari, als daar een nieuw model uit komt. Dan Opus 5.5 en Fable 5.2 opnieuw meenemen, inclusief de meta-analyse.
