-- Adres van zakelijke klanten, nodig voor de Moneybird-factuur (een factuur aan een bedrijf
-- moet het adres van het bedrijf bevatten). Uitvoeren in Supabase (SQL Editor).
-- Veilig om opnieuw te draaien (IF NOT EXISTS). Tot dit is uitgevoerd werkt afrekenen
-- gewoon door, alleen krijgt de factuur dan geen adres.

alter table arnobot_billing_customers
  add column if not exists straat text,
  add column if not exists postcode text,
  add column if not exists plaats text;
