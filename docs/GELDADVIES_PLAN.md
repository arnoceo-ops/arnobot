# Plan geldadvies: ArnoBot leest bedragen goed en adviseert de juiste kant op

## Status

**Laatst bijgewerkt:** 27 november 2026
**Waar we staan:** nulmeting en voorstel voor de kernset van het examen zijn klaar. Er is niets aan de chat, de prompt of de database aangepast. Arno moet de kernset en vier salesoordelen nog goedkeuren.
**Eerstvolgende stap:** na akkoord op de kernset het oorzaakonderzoek (zie fase 2). Modellen en betaalde testruns pas na dat akkoord.

- [x] Fase 0: nulmeting en kritische toets van het plan
- [ ] Fase 1: examen goedkeuren en uitbreiden
- [ ] Fase 2: oorzaak aantonen
- [ ] Fase 3: oplossingen bouwen en meten
- [ ] Fase 4: bewaking en herstel

Gesprekken, namen en bedragen van gebruikers komen niet in dit document of elders in de repo.

## Nulmeting (27 november 2026)

39 gesprekken met bedragen of cijfers (8 gebruikers, juni tot en met november, zonder testaccounts), gelezen door drie agents met elk een derde.

- 162 beurten met geldwerk, waarvan 90 met volgens de lezer een zekere fout (56%), 52 ernstig. De drie delen kwamen elk op 55 à 56%.
- Van 166 toegekende foutlabels in zeven soorten: verkeerde basis of verkeerd gelezen getal 40, aanname als feit 38, tegenspraak 26, gebruiker verkeerd weergegeven 22, richting omgedraaid 14, oordeel zonder beslissend gegeven 14, rekenfout (bij een deel inclusief niet nagerekend) 12.
- Beperkingen: dit is geen gemeten foutpercentage. Elke lezer is hetzelfde type model, bijlagen, geheugen en systeemprompt waren niet zichtbaar, oudere codeversies tellen mee, de afbakening verschilt per lezer en 24 van de 90 foute beurten komen uit één gesprek. De hoofdsessie las een selectie van de zwaarste beurten na, niet alle 90.
- Ernstige fouten komen ook voor in gesprekken van 24 tot en met 26 november, dus na de tabeltool.

## Besluiten

- **Geen losse promptregels als oplossing** (Arno, 27 november). Verworpen: twee aangescherpte regels naar aanleiding van één gesprek.
- **Eerst de oorzaak aantonen, dan pas kiezen** (model, denkstap, promptregels, gestructureerde geldstap, controle vooraf). Verworpen als eerste stap: direct van model wisselen, want dat verandert model en denkstap tegelijk en de diagnose is niet bewezen.
- **Het examen is een regressietest, geen bewijs van veiligheid.** Verworpen als enige lat: "geen omgedraaid advies in 10 tot 15 gevallen". Zelfs 45 foutloze onafhankelijke pogingen sluiten ongeveer 6% fouten niet uit. Daarom ook bewaking in productie en een herstelprocedure. Nul fouten wordt niet beloofd.
- Kwaliteit gaat vóór kosten.
- **Toets (Arno, 27 november):** kan een ontbrekend gegeven het oordeel omdraaien, dan vraagt ArnoBot eerst; anders noemt het de aanname hardop.
- **Toets (Arno, 27 november):** bij een prijswijziging vraagt ArnoBot of de kosten meedalen of al meegedaald zijn.
- **Toets (Arno, 27 november):** vraagt een klant om andere contractvoorwaarden, dan eerst bellen en de aanleiding achterhalen (mogelijk wil de klant weg) en kijken wat de klant kan behouden. Een al gegeven voordeel wordt in dat gesprek benoemd.
- Van de vier salesoordelen staat er nog één open.

## Fase 1: examen

Kernset van 13 gevallen (11 fout gegaan, 2 goed gegaan). Daarna uitbreiden naar 40 tot 60 met spiegelgevallen, een achtergehouden deel en gevallen waarin niet doorvragen juist is. Per geval vooraf een sleutel: wie betaalt wie, basisbedrag, richting, effect per keuze, onbekenden, toegestane adviezen. Beoordelen blind; een modelbeoordelaar signaleert alleen.

## Fase 2: oorzaak

Dezelfde mislukte beurten naspelen en steeds één onderdeel weghalen: geheugen, kennisbank, eerdere antwoorden, verdachte promptregels. Daarnaast hetzelfde model met en zonder denkstap, en een sterker model.

Hypotheses (niet bewezen):
- De regel "vraag en lever tegelijk" in `lib/systemPrompt.ts` eist eerst een antwoord op de meest logische aanname, zonder plicht die te noemen.
- De regels over altijd een mening en tegen de stroom in openen duwen naar een snel, stellig oordeel.
- De chat draait op `claude-sonnet-4-6` zonder thinking-parameter. Denktokens tellen mee in `max_tokens`, dus een denkstap vraagt meer ruimte.
- De zoekherschrijving voor de kennisbank ziet alleen de laatste vraag.
- Tekst vóór een hulpmiddel wordt niet getoond maar blijft in de context van het model (`lib/chatStreamRonde.ts`). In het gesprek van 26 november waren het alleen korte aankondigingen.

## Fase 3 en 4: kandidaten

- Gestructureerde geldstap: per bedrag vastleggen wat het is, met bronfragment of "aanname"; code rekent per keuze het effect en de richting.
- Controle vóór tonen bij geldadvies. De controleur leidt feiten en richting af zonder het concept te zien. Vooraf bepalen wat er bij onenigheid of storing gebeurt; detectie en vals alarm meten.
- Bewaking in productie: de huidige crons zien uitgeschreven sommen en brondekking, geen omgedraaid advies.
- Herstel: een fout advies werkt door in samenvatting, uitdaging, geheugen en sparadvies.
- Sparren en voice apart nalopen.
- `scripts/eval-cijfers.ts` wijkt af van de echte chat (telt weggefilterde tekst mee, zonder geheugen); het examen gebruikt de logica van de route.
