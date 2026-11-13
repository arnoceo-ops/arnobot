# Vertrouwen in ArnoBot: waarheidscontrole en coachstijl

**Laatst bijgewerkt:** 2026-11-13

**Waar we staan:** de widget is weg, vragen over Arno als persoon krijgen één vaste verwijzing, de bron per antwoord wordt bewaard (`arnobot_rds_logs.bron_context`), en elke maandag 07:15 UTC mailt `/api/cron/waarheidscontrole` Arno een steekproef van beweringen die niet uit de bibliotheek komen, plus echte taalfouten. De coachstijl is aangescherpt (bij ontbrekende informatie eerst een vraag, bij een duidelijk antwoord meteen adviseren), maar twee onderwerpen (klant te duur, pipeline) weiden nog uit.

**Eerstvolgende stap:**
1. Maandag 16 november: de eerste mail komt, verwacht klein (de bron wordt pas sinds 13 november bewaard).
2. **Maandag 23 november: eerste mail met een volle week.** Arno leest hem, geeft afgekeurde beweringen door; elke afkeuring wordt een testgeval en een aanpassing van een bestaande prompt, geen extra regel.
3. Daarna beslissen: een voorcheck "vraag eerst of meteen adviseren" (extra stap per bericht, alleen na meting op echte vragen), en een grotere modelmeting (15 vragen, 3 herhalingen, huidig model tegen Fable 5.2) op Arno's echte context.

**Afvinklijst**
- [x] Widget verwijderd, tabellen gedropt, ArnoBot alleen voor ingelogde gebruikers.
- [x] Vragen over Arno als persoon: vaste verwijzing naar een persoonlijk gesprek (regel in `RULE_NO_INVENTED_EXAMPLES`), blogverhalen van anderen nooit als eigen verhaal.
- [x] Eén bron voor Arno's ervaring (`lib/arnoFeiten.ts`): 44 jaar saleservaring, 35 jaar ondernemerschap, 17 jaar business coaching.
- [x] Promptverbeteraar zonder profiel, in de ik-vorm, zonder aannames.
- [x] Actie-extractie alleen uit salesinhoud (geen reminders over storingen).
- [x] Context per antwoord bewaard; wekelijkse waarheidscontrole en taalcontrole per mail.
- [ ] Eerste volle weekmail (23 november) gelezen en beoordeeld.
- [ ] Beslissing voorcheck "vraag eerst".
- [ ] Grotere modelmeting op echte context.
- [ ] Admin-tabblad STEEKPROEF met Klopt / Klopt niet (aparte bouw, nog niet gedaan).

**Besluiten en verworpen alternatieven**
Volledig beschreven in `docs/CLAUDE_HISTORY.md` (secties van 2026-11-13). Kort:
- Gekozen: geen zichtbare correctie of waarschuwing voor gebruikers; vertrouwen komt uit de voorkant en meten achter de schermen. Verworpen: een correctieregel onder antwoorden.
- Gekozen: geen moderatiepoort voor persoonlijke vragen (die blokkeerde gewone vragen, teruggedraaid); één zin in twee bestaande regels. Verworpen: een poort, extra regels.
- Gekozen: de lange versie van de persoonsregel behouden (18 van 18 naleving); de korte versie haalde 12 van 18. Verworpen: inkorten op woordtelling.
- Gekozen: geen extra taalregel in de prompt (geen effect gemeten), wel een taalcontrole in de weekmail. Verworpen: `RULE_NATUURLIJK_NEDERLANDS` in de hoofdchat.
- Gekozen: wekelijks in plaats van dagelijks. Verworpen: dagelijks.
- Nog niet gewisseld van model: geen model volgt de regel "eerst een vraag" betrouwbaarder; Sonnet 5.5 en Opus 5.5 verwijzen naar blogs die niet in de bron staan.
