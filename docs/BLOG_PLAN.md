# Blog op arno.bot/blog: plan en status

**Laatst bijgewerkt:** 2026-10-10

**Waar we staan:** de blog is gebouwd en live op productie (overzicht, artikel, hashtagpagina's, RSS, aanmelden met double opt-in, afmelden, voorkeuren, mailverzending met dagbudget, adminbeheer onder `/bot/admin/blog`, tab POSTS). Op productie end-to-end getest met een testpost en testabonnees (onderwerpfilter, batchverzending, geen dubbele mails, opruimen). De blog is nog niet vindbaar: `robots.ts` en `sitemap.ts` bevatten `/blog` bewust nog niet. Er staan nog geen echte posts.

**Eerstvolgende stap:** Arno leest alle teksten op de live pagina's (alles staat in `lib/blogCopy.ts`) en keurt goed of corrigeert. Daarna: `/blog` in `robots.ts` (`PUBLIC_PATHS`) en `sitemap.ts` (statische lijst plus gepubliceerde posts) zetten.

## Afvinklijst

- [x] SQL: posts, abonnees, bezorgwachtrij, bucket `blog-images` (`docs/sql/2026-10-10-blog.sql`, uitgevoerd)
- [x] Publieke pagina's, RSS, JSON-LD
- [x] Adminbeheer: editor met live voorbeeld, afbeeldingen, hashtags, inplannen, versturen, testmail
- [x] Aanmelden, bevestigen, afmelden (ook one-click). Onderwerpkeuze en voorkeurenpagina zijn op 10 oktober weer verwijderd
- [x] Verzending via `mail.arno.bot`, dagbudget, wachtrij, Redis-slot, idempotency-key
- [x] Cron elke 15 minuten (`/api/cron/blog`)
- [x] Footer-link naar `/blog`, oude arno.blog-URL-vormen blijven doorgestuurd
- [x] Docs en PDF's (overzicht, technische overdracht, CLAUDE.md-regels voor e-mailtypen en Resend)
- [x] End-to-end test op productie
- [ ] Arno keurt teksten goed (`lib/blogCopy.ts`)
- [ ] `/blog` in `robots.ts` en `sitemap.ts`
- [ ] Privacytekst voor blogabonnees (eerst als platte tekst aan Arno voorleggen, dan pas op `/privacy` en in `scripts/generate-security-pdf.mjs`; Resend en het subdomein als sub-verwerker noemen)
- [ ] Resend-webhook aanmaken (bounces en klachten) en `RESEND_WEBHOOK_SECRET` in Vercel zetten, daarna redeploy
- [ ] Eerste echte post schrijven
- [ ] Bij ~50 bevestigde abonnees: Resend Pro en `BLOG_DAILY_MAIL_BUDGET` verhogen (staat als milestone in CLAUDE.md)

## Besluiten en verworpen alternatieven

- **Gekozen:** intern bouwen, Resend als transport. **Verworpen:** externe nieuwsbrieftool (Substack, Beehiiv, Mailchimp), want nieuwe sub-verwerker, lijst buiten eigen database, blog niet onder eigen domein en geen koppeling met trial en funnel. **Verworpen:** Resend Audiences/Broadcasts, want lijst en templates buiten Supabase en `email-templates.ts`.
- **Gekozen:** posts in Supabase met adminpagina (publiceren zonder deploy). **Verworpen:** Markdown-bestanden in git, want elke post kost een deploy.
- **Gekozen:** abonneren is altijd op alle posts, hashtags zijn alleen om het archief te doorzoeken (10 oktober, Arno). **Verworpen:** abonneren per onderwerp met een voorkeurenpagina. Dat was eerst gebouwd, maar bleek onduidelijk en onnodig, en is verwijderd (pagina, API, mailvoetlink). De kolom `topics` staat nog in de database maar wordt niet meer gebruikt.
- **Gekozen:** doorzoekbaar archief op `/blog` (10 oktober, Arno): zoekveld dat direct filtert in de browser op hashtag (begin van een hashtag, met of zonder #) en trefwoord (titel, samenvatting), 12 kaarten per keer, zoekterm in de URL. De hashtagchips blijven links naar eigen hashtagpagina's (indexeerbaar). **Verworpen:** chips die alleen het zoekveld vullen (hashtagpagina's zouden geen interne links meer krijgen), en zoeken via de server per zoekterm (cachesleutel per term, misbruik mogelijk, onnodig bij een archief van enkele honderden posts). Bij een archief van duizenden posts is paginering of serverzoeken nodig. Het sitemap-item voor alle posts hoort bij de robots/sitemap-stap, zodat oudere posts voor zoekmachines vindbaar blijven.
- **Gekozen:** alleen hashtags, geen aparte categorieën. Tagpagina's met minder dan 3 posts zijn `noindex`.
- **Gekozen:** apart verzendsubdomein `mail.arno.bot`, zodat de reputatie van blogmails los staat van betalings- en trialmails. **Verworpen:** `blog@arno.bot`, want reputatie hangt aan het domein, niet aan het adres.
- **Gekozen:** Manual DNS-setup bij Vercel. **Verworpen:** Resend Auto configure, want schrijfrechten op de DNS van arno.bot.
- **Gekozen:** dagbudget voor blogmails (standaard 50 per UTC-dag) op de gratis Resend-tier (100 per dag voor alles samen). **Verworpen:** onbeperkt verzenden, want een blogpost kon dan betalings- en trialmails blokkeren.
- **Gekozen:** bevestigen met één klik vanuit de mail voor echte klikken (Sec-Fetch-User-header), met terugval op een knop-pagina voor scanners en oude browsers. **Verworpen:** altijd een extra knop (Arno vond de dubbele klik storend), en blind bevestigen bij elke GET (mailscanners zoals Microsoft Safe Links openen links vooraf en zouden voor ontvangers bevestigen, wat de dubbele opt-in waardeloos maakt). **Afmelden** blijft bewust een knop (POST): een scanner mag niemand afmelden.
- **Gekozen:** gecachete Supabase-GET's met tag `blog` (ververst via `revalidateBlog()`). **Verworpen:** statische pagina's, want de root layout leest `headers()` voor de CSP-nonce en rendert daardoor elke pagina per verzoek.
- **Gekozen:** onbekende slug onder `/blog` stuurt tijdelijk (307) door naar arno.blog. **Verworpen:** permanente redirect, want die blijft in de browser hangen als er later alsnog een post met die slug verschijnt.
- **Gekozen:** voornaam in het aanmeldformulier voor de aanhef in de mails (10 oktober), eerst optioneel, nog dezelfde dag **verplicht** gemaakt op Arno's verzoek (client en server valideren). Oudere rijen zonder naam krijgen geen aanhef. **Verworpen:** naam afleiden uit het e-mailadres, want vaak fout en een foute naam is erger dan geen naam.
- **Gekozen:** wie zich opnieuw aanmeldt terwijl het adres al bevestigd is, krijgt een mail "Je bent al aangemeld voor de ArnoBot blog" (knop NAAR DE BLOG, kleine linkjes voor afmelden en onderwerpen), het scherm blijft voor iedereen gelijk. **Verworpen:** een scherm dat meldt dat het adres al bestaat (maakt de lijst af te vragen) en niets sturen (de bezoeker wacht op een mail die nooit komt). De knop "onderwerpen aanpassen" is vervangen door NAAR DE BLOG, omdat de onderwerpkeuze pas zichtbaar is zodra er posts met hashtags zijn.
- **Gekozen:** marketingstijl zoals `/prijzen` (Figtree, Oswald), niet de privacypagina-stijl. Bodytekst `#94a3b8`, koppen `#f8fafc`, binnen de bestaande marketingnorm.
- **Gekozen:** de admin-tab heet POSTS (de tab BLOGS bestaat al en gaat over de arno.blog-briefing).
- **Tekstwijzigingen 10 oktober (Arno):** overzichtskop "ArnoBot Best Practices" met subtekst "Nieuwe functionaliteiten en hoe je ArnoBot voor je kunt laten werken"; abonneerblok 600px breed, kop "Abonneer je op ArnoBot's blog", alleen "Afmelden kan altijd met één klik." als tekst, bij het formulier alleen de link naar de privacyverklaring; geen lege-staat-tekst op het overzicht.
- **Teksten:** op Arno's expliciete akkoord eerst gebouwd en daarna gecorrigeerd, i.p.v. vooraf voorgelegd (afwijking van de standaardregel, gericht op deze blog). De privacytekst valt hier buiten en wordt wel eerst voorgelegd.

## Technische aandachtspunten

- Mailstroom: `lib/blogMail.ts` (verzending), `lib/blogSubscribers.ts` (abonneelogica), `lib/blogRateLimit.ts`, `lib/blogCopy.ts` (alle teksten).
- Afmeldtokens staan in mails: de paden `/blog/bevestig`, `/blog/afmelden` en `/blog/voorkeuren` zijn uitgesloten van pageview- en PostHog-tracking, `noindex` en `no-referrer`.
- CSP `img-src` bevat het eigen Supabase-project voor afbeeldingen in posts.
- `scripts/check-orphan-routes.mjs` begrijpt sinds deze bouw dynamische segmenten (`[id]`) in aanroepen via template-strings.
