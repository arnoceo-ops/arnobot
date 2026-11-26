-- Gratis account apart vastleggen (docs/REFERRAL_AUTOMATISERING.md). Uitvoeren in de Supabase SQL Editor.
-- Een nieuwe kolom op approved_users, alleen gevuld bij accounts die in het gebruikersbeheer als GRATIS staan (niet
-- betaald, geen proefstart, wel een einddatum, ook als die al verlopen is). Verder wijzigt er niets. Veilig om nog een
-- keer te draaien.

alter table public.approved_users
  add column if not exists gratis_sinds timestamptz;

update public.approved_users
  set gratis_sinds = now()
  where gratis_sinds is null and paid_at is null and trial_start is null and expires_at is not null;

-- Controle: dit zijn de accounts die nu als gratis gemarkeerd zijn.
select voornaam, achternaam, expires_at, gratis_sinds
from public.approved_users
where gratis_sinds is not null
order by voornaam;
