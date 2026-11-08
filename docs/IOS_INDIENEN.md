# iOS-app: plan, status en eisenlijst

**Laatst bijgewerkt:** 2026-11-08

**Waar we staan:** onderzoek klaar, nog niets gebouwd. Alle indieneisen van Apple zijn gelezen (zie vanaf de sectie "Eisenlijst en risico's"). De Android-app (1.0.4) is de basis; koop-, upgrade- en prijsverwijzingen zijn in de app al verborgen en dat werkt ook op iOS.

**Eerstvolgende stap:** na de pushmeldingen op Android (zie `docs/PUSH_PLAN.md`): inschrijven bij het Apple Developer Program als Individual. Dat kan al eerder gestart worden omdat de goedkeuring weken kan duren.

**Besluiten en verworpen alternatieven (2026-11-08):**
- Gekozen: **Individual-account**. Verworpen: Organization, want Apple eist voor een eenmanszaak een Individual-inschrijving en accepteert geen handelsnamen; een D-U-N-S-nummer verandert dat niet. Gevolg: Arno's eigen naam staat als verkoper in de store; omzetten kan later met een BV.
- Gekozen: **bouwen in de cloud** (Codemagic, Capawesome Cloud of GitHub Actions macOS-runners). Verworpen: een Mac huren, want niet nodig.
- Gekozen: **geen in-app aankoop**, abonnementen blijven via de website (Mollie, Moneybird). Verworpen (voor nu): in-app aankoop, want dat vraagt een tweede abonnementssysteem naast Mollie en past niet bij teamfacturen, referral-tegoed en zakelijke btw-facturen. Terugvaloptie als de review het eist.
- Gekozen: **pushmeldingen als echte native meerwaarde** tegen het webwrapper-risico (4.2), eerst op Android. Verworpen: indienen zonder native meerwaarde, want 4.2 is het grootste afwijzingsrisico.
- Gekozen: het **toestemmingsscherm voor AI-verwerking door derden** bouwen (5.1.2(i)), voor de Apple-versie en bij voorkeur voor beide apps.
- Niet nodig: **Sign in with Apple** zolang de app alleen e-mail en wachtwoord biedt, en **testers** (Apple heeft geen minimum).

**Afvinklijst:**
- [ ] Pushmeldingen op Android gebouwd en live (zie PUSH_PLAN)
- [ ] Apple Developer Program: Individual ingeschreven, handelaarsgegevens met zakelijk adres
- [ ] Toestemmingsscherm AI-verwerking gebouwd en getest
- [ ] iOS-project gegenereerd (`npx cap add ios`), microfoontekst in Info.plist, iconen
- [ ] Cloudbouw gekozen en eerste build in TestFlight
- [ ] Microfoontest op een echte iPhone (leen er een voor een uur)
- [ ] Opname-aanduiding gecontroleerd (2.5.14)
- [ ] App Store Connect ingevuld (screenshots, leeftijd, privacy, exportcompliance, demoaccount, Notes for Review)
- [ ] Store-compliance-agent met verse richtlijnen vlak voor indienen
- [ ] Ingediend

---

## Eisenlijst en risico's

> Opgesteld 2026-11-08 uit de officiële Apple-pagina's zelf (richtlijnen laatst bijgewerkt door Apple op 16 oktober 2026). Doel: geen verrassingen bij indienen. Elk punt is gemarkeerd: **[geverifieerd]** (Apple-tekst gelezen), **[samenvatting]** (alleen via een samenvatting gezien, controleer in de browser), **[niet geverifieerd]**. Geen juridisch advies.

## 1. Risico's, op volgorde van kans op afwijzing of gedoe

1. **4.2 Minimale functionaliteit (webwrapper).** Apple: "Your app should include features, content, and UI that elevate it beyond a repackaged website." De app is een Capacitor-schil om arno.bot. Het woord "wrapper" staat er niet in, het dichtstbijzijnde is 4.2.2 ("web clippings"). Wat er nu native is (microfoon, native splash, app-login) is mager, want de microfoon werkt ook in een browser. **Dit is het grootste afwijzingsrisico en pas bij de review te bevestigen.** Eerder in MOBILE_PLAN stond dat beide stores zo'n app toestaan zolang er native meerwaarde is; dat was niet geverifieerd. Te beslissen: welke echte native functies we toevoegen (bijvoorbeeld pushmeldingen) en hoe de Notes for Review dit uitleggen.
2. **3.1.3(b) en 3.1.1 betalen.** Toegang tot elders (website) gekochte abonnementen is toegestaan, maar de zin eindigt met "provided those items are also available as in-app purchases within the app". Of die voorwaarde alleen voor de games-voorbeelden geldt of voor alles, is dubbelzinnig. Onze lezing (toegang komt van buiten de app, niets te koop in de app) is verdedigbaar maar **niet zeker: kans middel**. Zonder machtiging mogen betaallinks alleen in de VS-storefront (3.1.1(a)); wij tonen er geen.
3. **5.1.2(i) expliciete toestemming voor AI-verwerking door derden.** Apple: "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." Gesprekken en spraak gaan naar Anthropic, OpenAI, AssemblyAI en Voyage AI (en ElevenLabs voor stem). **Gat:** nu staat er alleen "Door in te loggen/aan te melden ga je akkoord met de voorwaarden en privacyverklaring" op de web-aanmelding, en het ingekorte app-inlogscherm heeft dat niet. Dat is geen expliciete toestemming. Te bouwen: een toestemmingsscherm bij eerste gebruik in de app dat de verwerkers noemt, per gebruiker vastgelegd, en intrekbaar (5.1.1(ii)). Geldt ook voor de AVG, dus waarschijnlijk ook voor het web.
4. **Microfoon in WKWebView vanaf een externe https-pagina.** **[niet geverifieerd]** of `getUserMedia` zonder extra native code werkt. Dit is waarom een echte iPhone vroeg nodig is (zie sectie 6).
5. **2.5.14 opnemen.** Apple eist expliciete toestemming en een duidelijke zichtbare of hoorbare aanduiding tijdens opnemen. **[niet gecontroleerd]** of de spraak-UI dit toont.
6. **4.7 en 1.2 (chatbots, AI-inhoud).** 4.7 gaat over apps die andermans HTML5-mini-apps of chatbots aanbieden; vermoedelijk niet van toepassing op ons, **[niet nagelopen]**. Als Apple ons toch onder 1.2/4.7.1 schaart: filter, meldknop, blokkeren.
7. **2.5.2** (geen code downloaden die functies wijzigt) terwijl de app een externe site laadt: laag risico, een WKWebView-schil is gangbaar, maar de tekst zegt er niets over.

## 2. Al goed bevonden (in de code op master, 2026-11-08)

- Accountverwijdering staat in de app zichtbaar (ACCOUNT VERWIJDEREN); alleen de link "zakelijk-corrigeren" is in de app verborgen. Apple eist verwijdering in de app als de app accountaanmaak ondersteunt (5.1.1(v)); wij hebben het toch.
- De privacyverklaring noemt Anthropic, AssemblyAI, ElevenLabs, OpenAI, Supabase en Voyage, en de accountpagina linkt ernaar (5.1.1(i): link in App Store Connect én in de app).
- Koop-, upgrade- en prijsverwijzingen zijn in de app verborgen (`HideInNativeApp`, `useIsNativeApp`; werkt ook op iOS).
- Sign in with Apple is niet nodig zolang de app alleen e-mail en wachtwoord biedt (4.8 geldt alleen bij sociale logins). Stap 6 in MOBILE_PLAN ("Sign in with Apple toevoegen") vervalt daarmee, tenzij we sociale logins in de app toevoegen.

## 3. Account en administratie

- **Individual**, niet Organization: Apple zegt "If you are a sole proprietor/single-person business, you must join as an individual and your legal name will appear as the seller." Een D-U-N-S-nummer verandert dat niet; DBAs, handelsnamen en filialen worden niet geaccepteerd. Gevolg: de verkopernaam in de store is Arno's eigen naam. Omzetten naar Organization kan later, met een rechtspersoon (BV). [geverifieerd: developer.apple.com/help/account/membership/program-enrollment en .../D-U-N-S]
- **Kosten** ongeveer 99 dollar per jaar [niet geverifieerd bij Apple zelf]. Apple Account met tweefactorauthenticatie, wettelijke naam, foto van identiteitsbewijs. Inschrijven kan via het web. Goedkeuring kan weken duren (forumberichten, anekdotisch).
- **Handelaarsstatus (EU Digital Services Act)** [samenvatting]: je moet een status opgeven. Als trader geef je adres (of postbus), telefoon en e-mail op, beide verifieerbaar met tweefactor, plus een document met bedrijfsnaam en adres. Apple publiceert dit op de productpagina voor apps in de EU. **Gebruik het zakelijke adres, niet het privéadres** (zelfde punt als bij Google). Niet gecontroleerd welk veld precies getoond wordt: controleer in App Store Connect.
- **Geen testers nodig.** Geen minimum aantal testers of testperiode gevonden. TestFlight is niet verplicht (Apple-forumantwoord, geen officiële regel), wel aanbevolen. Maxima: 100 interne en 10.000 externe testers.

## 4. Verplicht in App Store Connect

- App-record aanmaken, build uploaden, build kiezen en indienen [samenvatting].
- **Screenshots** [samenvatting]: minimaal 1, maximaal 10 per maat; JPEG of PNG zonder transparantie. Verplicht minimaal één voor "iPhone with Dynamic Island (medium)": 1179×2556 of 1206×2622. Daarnaast Face ID (groot: 1284×2778 of 1242×2688) óf Dynamic Island (groot: 1260×2736, 1290×2796 of 1320×2868). Richtlijn 2.3.3: de app in gebruik tonen, niet het inlogscherm. 2.3.9: fictieve gegevens. 2.3.10: geen verwijzing naar Android of Google Play.
- **Leeftijdsclassificatie**: verplicht, vragenlijst eerlijk invullen [samenvatting].
- **App-privacy (voedingslabel)** en **privacybeleid-URL**: verplicht [geverifieerd]. Ook data die derde partijen verzamelen moet erin, ook als het alleen voor de functionaliteit is.
- **Exportcompliance/encryptie**: vragen bij elke indiening; te beantwoorden dat alleen standaard HTTPS-versleuteling gebruikt wordt. De sleutel `ITSAppUsesNonExemptEncryption` is **[niet geverifieerd]**.
- **Overige velden** [samenvatting, controleer in de browser welke verplicht zijn]: naam, ondertitel, primaire categorie, content rights, support-URL, copyright, beschrijving.
- **Demoaccount** (2.1(a)): werkend adres en wachtwoord op het moment van indienen, en de backend (Supabase, Vercel, AI-leveranciers) moet tijdens de review live en gevuld zijn. Het demoaccount moet toegang hebben (een verlopen trial wordt afgewezen). Eventuele verificatiecodes vooraf in de Notes zetten, anders kan de review dagen vertragen [geverifieerd: Apple "Complete your app review information"].
- **Notes for Review** (2.3.1(a)): concreet beschrijven wat de app doet, de AI-coach, de spraakinvoer, de externe diensten, waarom accounts via de website lopen, en de native meerwaarde (zie risico 1).

## 5. Technisch

- Uploaden vereist Xcode 26 met de iOS 26 SDK (sinds 28 april 2026) en deployment target iOS 13 of hoger (sinds 9 september 2026) [geverifieerd: developer.apple.com/news/upcoming-requirements]. Capacitor 8 eist iOS 15+, Xcode 26+, Node 22+; Swift Package Manager is de standaard [geverifieerd: capacitorjs.com/docs/ios]. **Controleer welke Capacitor-hoofdversie wij nu hebben**; een Android-build op een oudere versie moet eerst mee-geüpgraded worden.
- `npx cap add ios` werkt op Windows (met een CocoaPods-waarschuwing); het bouwen gebeurt in een cloud-Mac (Codemagic, Capawesome Cloud of GitHub Actions macOS-runners) [leveranciersbronnen]. SPM-oplossing in de cloudbuild [niet geverifieerd].
- `NSMicrophoneUsageDescription` in Info.plist is verplicht (anders sluit de app af bij microfoongebruik) en de tekst moet zeggen dat spraak naar externe spraakdiensten gaat (5.1.1(ii)) [sleutelnaam geverifieerd, gedrag samenvatting].
- Privacy manifest (`PrivacyInfo.xcprivacy`): Apple vraagt goedgekeurde redenen voor bepaalde API's, ook van plugins; "niet alle apps worden gemarkeerd" [deels geverifieerd]. Controleren in de eerste cloudbuild.

## 6. iPhone nodig

Niet voor inschrijven, bouwen of indienen. Wel zodra de eerste build in TestFlight staat: TestFlight draait alleen op iPhone of iPad, en de microfoontest (risico 4) hoort bij die eerste build, niet pas vlak voor indienen, omdat spraak anders mogelijk niet werkt en dan nog native code vraagt. Leen er een voor een uur. Of een cloud-iPhone TestFlight-builds draait is niet bevestigd.

## 7. Volgorde

1. Inschrijven als Individual (lange wachttijd, nu starten), handelaarsgegevens met zakelijk adres voorbereiden.
2. Capacitor-versie checken, iOS-project genereren, Info.plist (microfoontekst), iconen, cloudbouw kiezen.
3. Toestemmingsscherm voor AI-verwerking ontwerpen en bouwen (risico 3).
4. Eerste build naar TestFlight, microfoon op een echte iPhone testen (risico 4 en 5).
5. Native meerwaarde beslissen en bouwen (risico 1).
6. App Store Connect invullen (sectie 4), demoaccount aanmaken en controleren, Notes schrijven.
7. Vlak vóór indienen: de store-compliance-agent met verse richtlijnen, en de niet-geverifieerde punten hierboven nalopen.
