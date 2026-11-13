-- Coaching-historie volledig bewaren (2026-11-13)
--
-- Tot nu toe bewaart arnobot_coaching_history alleen scores, diagnoses en voortgang.
-- Focus, blinde vlekken, ontwikkelpunten, opdracht, richtingen, blogtips en signalen
-- stonden alleen in arnobot_coaching, en die rij wordt bij elke nieuwe rapportage overschreven.
--
-- Dit script voegt de ontbrekende kolommen toe. Alleen toevoegen, niets wijzigen of verwijderen,
-- en bestaande rijen blijven ongewijzigd (de nieuwe kolommen zijn daar NULL, want die data
-- bestaat niet meer). Veilig om twee keer te draaien.
--
-- jsonb voor ontwikkelpunten, blogs en signalen: ontwikkelpunten is in oude rapportages een
-- lijst strings en in nieuwe een lijst objecten ({ "tekst": ... }), jsonb slikt beide.
--
-- RLS blijft zoals het was (ALTER raakt dat niet aan). Controle achteraf: Database, Tables,
-- kolom RLS bij arnobot_coaching_history moet aan staan.
--
-- Pas NA het draaien van dit script gaat de code de nieuwe kolommen vullen. Andersom
-- faalt de insert in app/api/bot/coaching/route.ts op onbekende kolommen.

alter table public.arnobot_coaching_history
  add column if not exists focus              text,
  add column if not exists blinde_vlekken     text,
  add column if not exists ontwikkelpunten    jsonb,
  add column if not exists opdracht           text,
  add column if not exists blogs              jsonb,
  add column if not exists signalen           jsonb,
  add column if not exists mindset_richting   text,
  add column if not exists systeem_richting   text,
  add column if not exists actie_richting     text,
  add column if not exists weinig_voortgang   boolean,
  add column if not exists stagnatie          boolean,
  add column if not exists conversation_count integer,
  add column if not exists used_session_ids   jsonb,
  add column if not exists used_analyse_ids   jsonb;

-- Controle: moet 14 nieuwe kolommen tonen
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'arnobot_coaching_history'
order by ordinal_position;
