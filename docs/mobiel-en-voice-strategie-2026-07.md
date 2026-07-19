# ArnoBot mobiel + voice strategie

Synthese van een verkennend gesprek over de vraag: hoe maken we ArnoBot mobielwaardig op een manier die daadwerkelijk meer gebruik oplevert, niet alleen "de website in een app-jasje". Bedoeld als input voor verdere besluitvorming en om aan een marketing expert voor te leggen.

---

## 1. Aanleiding

Arno deelde een ChatGPT-gesprek over het omzetten van ArnoBot (Next.js op Vercel) naar een native app via Capacitor, met een roadmap richting App Store/Play Store. Twee signalen gaven aanleiding om dieper te kijken dan die roadmap:

- Een testgebruiker: "ik open makkelijker vanaf mijn beginscherm een app dan elke keer in de browser naar arnobot toe te gaan."
- Reactie op de vraag "je leest toch niet lange berichten op mobiel?": "dat heeft ChatGPT toch ook?"

Beide punten zijn terecht en corrigeren een aanvankelijke aanname dat ArnoBot's lange, tekstrijke antwoorden mobiel gebruik principieel in de weg zouden staan.

## 2. Beoordeling van het ChatGPT-plan (Capacitor-route)

De kernaanbeveling van ChatGPT (Capacitor gebruiken om de bestaande Next.js-app te verpakken in plaats van alles native te herbouwen) is technisch juist. ChatGPT kent de codebase echter niet, en mist daardoor een aantal concrete risico's:

- **Clerk/LinkedIn OAuth in een ingesloten webview**: sommige OAuth-providers weigeren of ontmoedigen inloggen vanuit een embedded webview. Moet getest worden, niet aangenomen.
- **CORS-allowlist**: `app/api/chat/route.ts` heeft een expliciete `ALLOWED_ORIGINS`-lijst. Als Capacitor de app als losse bundel host (in plaats van de live site in een webview te laden), moet het custom app-origin daaraan toegevoegd worden.
- **Upstash rate limiting is per IP**: mobiele gebruikers delen vaak een IP via provider-NAT, wat legitieme gebruikers onterecht kan laten blokkeren.
- **Betaalprovider nog niet gekozen** (bestaand openstaand punt, zie Dunning Flow). Dit bepaalt of en hoe Apple/Google in-app-aankoop-regels van toepassing worden, een groter en fundamenteler blokkade dan de technische verpakking zelf.

## 3. De kernspanning

Arno's eigen observatie: ArnoBot's antwoorden zijn lang en tekstrijk, ontworpen om gelezen te worden, niet gescand. Een kale Capacitor-wrapper voegt weinig toe aan wat de mobiele website al biedt (hooguit een beginscherm-icoon en pushmeldingen). De enige verandering die een app echt de moeite waard maakt: **natuurlijke voice**, zodat je met ArnoBot kunt praten in plaats van lezen. Het risico daarbij, door Arno zelf benoemd: bij volledig dynamische, nooit-gecachete antwoorden kan spraaksynthese onbetaalbaar duur worden.

## 4. Technische route voor voice

Twee architecturen bestaan in de markt:

1. **Cascaded pipeline** (spraak-naar-tekst → taalmodel → tekst-naar-spraak, drie losse stappen). Dit is wat ArnoBot al gedeeltelijk heeft.
2. **Speech-to-speech modellen** (zoals achter ChatGPT's Advanced Voice Mode / het nieuwere GPT-Live): één audio-naar-audio-model zonder tekst als tussenstap, hoort en reproduceert toon en emotie, inmiddels zelfs full-duplex. Klinkt het natuurlijkst, maar is het zwaarste en duurste model.

**Keuze: cascaded pipeline houden**, met een betere TTS-laag. Speech-to-speech is een mogelijke latere upgrade, geen startpunt.

### Het TTS-kwaliteitsprobleem is geen kostenprobleem

ArnoBot draait momenteel `tts-1-hd` (OpenAI), al de duurdere tier, en Arno vindt de kwaliteit in het Nederlands nog steeds slecht. Diagnose: OpenAI's stemmen zijn primair op Engels getraind, Nederlandse tekst klinkt daar inherent stijver doorheen, dit is een taalprobleem, geen instelling die je kunt opschroeven.

**Oplossing: ElevenLabs Flash v2.5, rechtstreeks via ElevenLabs' eigen API** (niet via een tussenpartij/reseller zoals WaveSpeedAI, die alleen de standaard stemmenbibliotheek aanbiedt, geen toegang tot een eigen gekloonde stem).
- $0,05 per 1000 tekens, gefactureerd in dollars per teken (bevestigd op `elevenlabs.io/pricing/api`, geen credits-systeem voor directe API-facturering), ~75ms latency, specifiek gebouwd voor real-time conversational voice agents.
- Sterke multilinguale kwaliteit inclusief Nederlands, in tegenstelling tot een Engelse stem die Nederlands "meespreekt".
- Native streaming ondersteund via ElevenLabs' eigen `/stream`-endpoint (audio begint af te spelen terwijl de rest nog gegenereerd wordt), bevestigd in hun eigen API-documentatie. Dit geldt voor hun eigen API, niet gegarandeerd bij een tussenpartij.
- Ondersteunt **Instant Voice Cloning** (1-5 min audio, vereist het **Starter-plan, $6/maand**) en **Professional Voice Cloning** (30+ min audio, hogere kwaliteit, vereist het **Creator-plan, $22/maand, eerste maand $11**) in het Nederlands. Dit zijn vaste, terugkerende bedrijfskosten voor het ElevenLabs-account zelf, los van de generatiekosten per bericht.
- Geen expliciete prijsopslag gevonden voor gegenereerde spraak met een gekloonde stem ten opzichte van een standaardstem uit de bibliotheek, maar ook niet expliciet bevestigd in ElevenLabs' eigen documentatie. Behandel dit als waarschijnlijk maar niet 100% zeker totdat het met een eigen testaccount is geverifieerd.

**Aanbeveling: Professional Voice Cloning met Arno's eigen stem, via een eigen ElevenLabs-account (Creator-plan of hoger).** Dit is niet een bijkomstige feature maar het onderscheidende merkelement: niet "een AI met een prettige stem", maar letterlijk Arno's eigen stem die coacht. Geen toestemmingsvraagstuk, het is zijn eigen stem.

## 5. Feitelijke gebruiksdata (Supabase, direct opgevraagd)

| Bron | Aantal | Gemiddeld | Kortste / langste |
|---|---|---|---|
| Hoofdchat (`arnobot_rds_logs`) | 353 | 1745 tekens | 2 / 7181 |
| Widget-chat (arno.blog) | 30 | 1740 tekens | 77 / 3223 |
| Sessie-terugblik (Bieb) | 130 | 453 tekens | 32 / 1058 |
| Sparring-debriefs | 0 bruikbaar | n.v.t. | vrijwel alle historische debriefs zijn leeg door een inmiddels gefixte bug, nog geen verse data |

60% van de hoofdchat-antwoorden (210 van de 353) zit boven de 1000 tekens. De Bieb-samenvatting (gemiddeld 453 tekens) bewijst dat een korte, prettige samenvattingsstijl al werkt binnen deze codebase, dat is het na te streven voorbeeld voor voice-antwoorden.

## 6. Kostenanalyse voice (op basis van echte cijfers)

**Aannames:** gemiddelde ingesproken vraag ~0,3 minuut, antwoord met een maximum van 1000 tekens (niet per se elk antwoord raakt dat plafond).

- Inspreken (Whisper, $0,006/minuut): $0,0018 per bericht, verwaarloosbaar in het totaalplaatje.
- Beluisteren (ElevenLabs Flash, $0,05/1000 tekens): $0,05 per bericht in het slechtste geval (plafond volledig benut).
- Per bericht totaal: ~$0,05 à $0,052.

**Per gebruiker per maand** (10 berichten/dag × 20 werkdagen = 200 berichten):
- Worst case (elk antwoord op het plafond): ~$10,40/maand.
- Realistischer (plafond is een maximum, geen streefwaarde, gemiddeld eerder 600-700 tekens): ~$7/maand.

**Plus een vaste bedrijfskost, los van het aantal gebruikers:** het ElevenLabs Creator-plan ($22/maand) om Professional Voice Cloning te kunnen gebruiken voor Arno's eigen stem. Verwaarloosbaar ten opzichte van de kosten per gebruiker hierboven, maar hoort in de rekensom.

**Tegen €77/maand abonnementsprijs:** 9-14% van de omzet per actieve voice-gebruiker. Ruim behapbaar als vaste kostenpost, geen dealbreaker, maar wel een reden om ArnoBot in voice-modus te instrueren gemiddeld rond de 500-700 tekens te blijven schrijven met 1000 als harde bovengrens, in plaats van standaard tot het plafond te schrijven.

## 7. Voorgesteld prijsmodel

Arno's eigen voorstel, met aanscherpingen vanuit gesprek:

- **Basis blijft €77/maand**, voice (kort, mobiel) standaard inbegrepen, niet als losse add-on.
  - *Waarom inbegrepen in plaats van add-on:* verliesaversie is een van de sterkst onderbouwde effecten in gedragspsychologie. Mensen vechten harder om iets te behouden dat ze al hebben dan ze moeite doen om iets nieuws aan te schaffen. Voice als inbegrepen proefervaring, die daarna deels wordt teruggebracht, werkt sterker op retentie dan voice als iets wat je er apart bij moet kopen.
- **30 dagen volledig vrij** (bijvoorbeeld 200 berichten), zodat een gewoonte kan ontstaan.
- **Na 30 dagen niet volledig terug naar nul.** Een harde cliff-edge kan als straf aanvoelen en opzegging triggeren uit frustratie. Beter: een klein gratis restant (20-30 berichten/maand, "genoeg om het af en toe te blijven gebruiken"), met de volle 200 als betaalde upgrade.
- **Overage-mechanisme vergelijkbaar met LLM-tokens/credits** (bekend concept voor wie AI-tools gebruikt), maar in de UI **niet "tokens" noemen**. Concreet en jargonvrij: "voice-berichten" of "spraakminuten", in lijn met hoe ArnoBot verder ook communiceert.
- **Tekst-'uitgebreid' op pc blijft gratis voor iedereen**, zoals nu al het geval is (`SparClient.tsx` heeft dit al als vrije keuze voor elke abonnee). Dit expliciet **niet** achter een nieuwe premium-laag zetten: dat is geen nieuwe upsell maar het afpakken van een bestaande, gratis functie, met reëel risico op klantvertrouwen en opzeggingen.

## 8. Openstaande vragen en vervolgstappen

- **Hoeveel % van de gebruikers zal de voice-cap daadwerkelijk raken?** Onbekend, moet na lancering gemeten worden. Bepaalt of 200 berichten de juiste grens is.
- **Daadwerkelijke stemkwaliteit testen** (ElevenLabs Flash v2.5 in het Nederlands, en specifiek de kloon van Arno's eigen stem) vóór verder te bouwen. Dit is nu beoordeeld op basis van documentatie en reputatie, niet op een beluisterde test.
- **Bevestigen met een echt ElevenLabs-account** of gegenereerde spraak met een gekloonde stem echt hetzelfde per-teken-tarief heeft als een standaardstem. Niet expliciet gevonden in hun eigen documentatie, alleen niet-tegengesproken.
- **Naam/positionering van de premium-laag** en de bredere marketingboodschap ("ArnoBot spreekt met je, in mijn eigen stem" oid) zijn nog niet uitgewerkt, hier kan een marketing expert waarde toevoegen.
- **Technische risico's uit de app-conversie** (OAuth in webview, CORS, IP-rate-limiting) moeten apart en vroeg getest worden, los van het voice-vraagstuk.
- **Betaalprovider-keuze** (bestaand openstaand punt) bepaalt uiteindelijk de concrete implementatie van het credit/upgrade-mechanisme en de Apple/Google in-app-aankoop-compliance.

## 9. Samenvattend advies

Niet beginnen met de app-verpakking (Capacitor, App Store, Play Store), die is zinloos zolang de kern-ervaring niet mobiel-waardig is. Eerst voice oplossen en testen op de bestaande webapp (kan zonder Capacitor, spraak werkt al in de browser): Whisper voor invoer, ElevenLabs Flash v2.5 met Arno's eigen gekloonde stem voor uitvoer, korte spreekstijl (500-700 tekens richting, 1000 als plafond). Pas als dat aantoonbaar goed klinkt en aanslaat, is de stap naar een echte native app de moeite waard, met het voorgestelde 30-dagen-trial-en-zacht-landen prijsmodel als groeimotor.
