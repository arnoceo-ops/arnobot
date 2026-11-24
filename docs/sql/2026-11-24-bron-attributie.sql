-- Bronattributie voor de folder en landingpagina's (docs/FOLDER_PLAN.md).
-- Een folder-QR wijst naar /start?bron=folder-solo (of /start/team?bron=folder-team).
-- De bron wordt bewaard bij de pageview (scan), de klik op de aanmeldknop en de
-- aanmelding zelf, zodat de funnel per bron te splitsen is.
-- Alleen nullable kolommen: bestaande rijen en code blijven ongewijzigd werken.
-- Idempotent, veilig om twee keer te draaien. RLS blijft zoals het was (geen nieuwe tabel).

alter table arnobot_pageviews  add column if not exists bron text;
alter table arnobot_cta_clicks add column if not exists bron text;
alter table approved_users     add column if not exists bron text;

-- Bron is een korte code (kleine letters, cijfers, streepje). De app valideert dat ook,
-- dit vangt een vergissing of misbruik op databaseniveau af.
alter table arnobot_pageviews  drop constraint if exists arnobot_pageviews_bron_check;
alter table arnobot_pageviews  add constraint arnobot_pageviews_bron_check
  check (bron is null or bron ~ '^[a-z0-9-]{1,40}$');

alter table arnobot_cta_clicks drop constraint if exists arnobot_cta_clicks_bron_check;
alter table arnobot_cta_clicks add constraint arnobot_cta_clicks_bron_check
  check (bron is null or bron ~ '^[a-z0-9-]{1,40}$');

alter table approved_users     drop constraint if exists approved_users_bron_check;
alter table approved_users     add constraint approved_users_bron_check
  check (bron is null or bron ~ '^[a-z0-9-]{1,40}$');

-- Gedeeltelijke indexen: bijna alle rijen hebben geen bron, de stats kijken alleen naar die met.
create index if not exists arnobot_pageviews_bron_idx  on arnobot_pageviews  (bron) where bron is not null;
create index if not exists arnobot_cta_clicks_bron_idx on arnobot_cta_clicks (bron) where bron is not null;
create index if not exists approved_users_bron_idx     on approved_users     (bron) where bron is not null;
