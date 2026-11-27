# Ontwerp antwoordcontrole

## Status

**Laatst bijgewerkt:** 27 november 2026
**Waar we staan:** eerste versie aangevallen door een agent zonder voorgeschiedenis en daarop herzien. Niets gebouwd, de chat is niet aangepast, geen nieuwe testkosten.
**Gedragstest stap 1 (27 november, 15 antwoorden, Sonnet 4.6, geschat $1,15, `scripts/test-hervat.ts` op de tak): lat niet gehaald.** Later bericht dat uitdrukkelijk naar het oude deel verwijst: 5 van 5 zegt dat niet te zien en vraagt ernaar. Vraag die het oude deel niet nodig heeft: 5 van 5 gewoon antwoord. Het echte eerste bericht na de stilte (verwijst alleen zijdelings, met geplakte mail): 0 van 5 meldt dat het eerdere deel ontbreekt, alle geven meteen een oordeel. Beoordeeld door de bouwsessie zelf, niet blind. Het script bouwt de ingekorte geschiedenis zelf op en test dus alleen het gedrag; het inkorten is met unit-tests getest. Criterium niet achteraf versoepeld.
**Besluit Arno (27 november): verworpen** zijn de oude berichten weglaten, met of zonder melding op het scherm. De app belooft dat een gesprek voortgezet wordt en dat ArnoBot onthoudt (archiefknop "VERVOLG DIT GESPREK IN ARNOBOT", `lib/appHelp.ts` "Gesprek voortzetten", `/start` "Hij onthoudt", welkomstmail). De tak `fix/hervatten-48u` gaat zo niet live. De bouwsessie had die beloftes niet nagekeken voor het ontwerp.
**Nieuw voorstel, nog niet goedgekeurd:** de oude berichten gaan op elke beurt mee als echte gespreksbeurten, met de datum per bericht (door de server uit de opgeslagen tijden) en bij het eerste nieuwe bericht hoeveel dagen er tussen zaten. Op 31 oktober waren als oorzaak oude berichten zonder tijdsaanduiding en een prompt zonder datum van vandaag; verworpen werden toen alleen een tijdnotitie in de prompt en een letterlijk fragment. Datum per bericht staat niet als geprobeerd vermeld. Toets op beide fouten: oude stukken worden gebruikt, en oud wordt niet als nu gebracht. Tijdelijke bijlagen zijn na 48 uur weg; geplakte tekst blijft.
**Achterhaald:** de reparatie neemt vanaf het tweede bericht ook informatie weg die ArnoBot nu wel krijgt. Voorstel: alleen live samen met een vaste melding op het scherm (in code, niet via het model), tekst vooraf door Arno goed te keuren. Nog niet besloten.
**Eerdere stap:** stap 1 staat gebouwd op de tak `fix/hervatten-48u` (werkmap `C:\Users\arno\arnobot-48u`), niet op master en niet live. Tests, typecontrole en lint geslaagd. Wacht op akkoord voor de gedragstest (naspelen, geschat $1,50, harde grens $2) en daarna op akkoord om live te zetten. Keurt Arno ook de nieuwe instructietekst in `lib/hervatGesprek.ts` goed.

- [ ] Stap 1: gesprek hervatten na 48 uur, smalle reparatie
- [ ] Stap 2: een controlerun op bestaande antwoorden (apart akkoord, harde grens)
- [ ] Stap 3: herschrijven blind meten (alleen als stap 2 slaagt)
- [ ] Pas daarna besluiten over inbouwen in de chat en bewaking

Aanleiding en eerdere meetresultaten: `docs/GELDADVIES_PLAN.md`. Geen gebruikersgegevens in dit document.

## Doel en grens

Minder ernstige leesfouten en toeschrijvingen. Niet foutloos. **Er is op dit moment geen stap met aangetoonde winst op het aantal fouten.**

## Stap 1: hervatten na 48 uur

Uit de code (niet in een browser uitgevoerd):
- Herladen na meer dan 48 uur geeft een vers gesprek (`app/bot/SparClient.tsx` rond 897-911). Wie typt voor die controle klaar is, gebruikt nog het oude gesprek zonder geschiedenis en zonder melding.
- Hervatten via `?resume=` en een open gebleven tabblad tonen alle oude berichten en sturen ze mee.
- Eerste bericht daarna: de server laat de geschiedenis weg (`app/api/chat/route.ts` rond 546, `lib/geheugenContext.ts` rond 291-307). Zonder sessierij gaan tot 300 tekens van een oud eigen bericht mee. Moderatie en enkele voorwaardelijke regels zien de oude geschiedenis wel.
- Tweede bericht: alle oude berichten gaan ongedateerd mee (hooguit de laatste 100) en het waarschuwingsblok vervalt.
- Voice logt zonder geschiedenis (`app/api/chat-voice/route.ts` rond 63-69). Na een voicebericht geldt al het eerste tekstbericht als vers.

Smalle reparatie:
1. De server bepaalt de grens op elke beurt uit opgeslagen, gedateerde berichten, niet uit wat het scherm meestuurt. Alleen berichten van na de laatste stilte van meer dan 48 uur gaan als geschiedenis mee.
2. Voice telt daarbij niet als nieuw begin.
3. Bij elke beurt in zo'n hervat gesprek hoort het model dat het het eerdere deel niet ziet, dat het daar niet over raadt en om het stuk vraagt als het ervan afhangt.

Wat dit niet doet: de oude inhoud teruggeven. Dat de gebruiker het scherm wel ziet en moet plakken, blijft. Of het model zich aan punt 3 houdt, moet blijken uit naspelen (kost API-tegoed, bedrag vooraf).

**Later, apart:** oude eigen berichten gedateerd teruggeven. Niet in stap 1: letterlijke fragmenten en een tijdnotitie zijn op 31 oktober geprobeerd en verworpen (zie `docs/CLAUDE_HISTORY.md`), tijdelijke documenten verlopen na dezelfde 48 uur (`lib/documentenRegels.ts`), de sessieroute geeft alleen vraag en antwoord en `bron_context` verdwijnt na 30 dagen.

Niet gedekt: foute recente antwoorden van de coach die in de geschiedenis blijven staan.

## Stap 2: een controlerun als stopfilter

Een controlemodel leest bestaande antwoorden na op toeschrijvingen, feiten over derden, iets over het hoofd zien, inhoud van een concept en richting van geldadvies. Bronnen zijn per auteur gemarkeerd: geheugen en eerdere coachantwoorden bevatten door de coach geschreven tekst en tellen niet als bewijs over de gebruiker. Het model krijgt geen sleutels.

Meetset: de 32 antwoorden van de modeltest. Volgens beide juryleden samen 33 gedeelde ernstige fouten (handmatig gekoppeld op passage en strekking, naar schatting 20 tot 22 verschillende, uit 8 beurten). 20 antwoorden hebben minstens een gedeelde fout, 8 zijn volgens beiden foutloos, 4 omstreden.

Lat vooraf:
- minstens 24 van de 33 gevonden, en alleen als passage en reden kloppen;
- alle andere meldingen tellen en met de hand beoordelen;
- duidelijk beter dan een nepcontrole die alles boven 180 woorden afkeurt. Die raakt 32 van de 33 met 2 van de 8 vals alarm, zonder iets te lezen. Daarom telt alleen de passage.

Beperkingen: alle 8 foutloze antwoorden zijn kort (hooguit 230 woorden), enkele zijn inhoudelijk zwak, dus vals alarm op lange goede antwoorden is niet te meten. Juryleden en kandidaten zijn allemaal Claude. Wie op deze set bijstelt, heeft een nieuwe set nodig. **Slagen is geen bewijs dat inbouwen werkt; zakken betekent stoppen.**

## Stap 3: herschrijven meten

Alleen na een gehaalde stap 2: laat de antwoorden met meldingen een keer herschrijven en tel blind de fouten voor en na, inclusief nieuwe. Zonder deze meting wordt niets in de chat gebouwd.

## Daarna, nog niet ontworpen tot besluit

Inbouwen vraagt: bepalen wat hoog risico is en hoe vaak dat voorkomt (niet gemeten; de herkenningsproef ging alleen over geld), wachttijd zonder streaming (geldtest: mediaan 59 s), keuze bij een blijvende fout of storing, toolrondes, het vervolg na `max_tokens`, voice, de routelimiet van 300 s, en statusteksten die Arno vooraf goedkeurt. Bewaking van echte antwoorden volgt pas als de controle goed meet.

## Verworpen

- **Controle in code op citaten, data en bedragen** (eerste versie, stap B): had hooguit 3 van de 33 gedeelde fouten kunnen vinden, alle drie via zinnen als "had gevraagd" en hetzelfde patroon; de datum- en bedragregels geen enkele. Kennisfragmenten en geheugen bevatten veel tekst die verzinsels kan "dekken".
- **Lat "7 van 10 gevonden, 2 van 10 vals alarm":** niet haalbaar met 8 foutloze antwoorden en te omzeilen met lengte.
- **Regel van 31 oktober terugdraaien:** brengt oud als actueel terug.
- **Citations API:** niet te combineren met structured outputs en dwingt geen verwijzing per bewering af (claude-api skill, tabel 3 november 2026, niet live nagekeken).

## Als dit niet genoeg is

Dan geen nieuwe lagen, maar een productbesluit over wat ArnoBot belooft, bijvoorbeeld sparren en meedenken, waarbij de gebruiker feiten, bedragen en verzendklare teksten zelf controleert.
