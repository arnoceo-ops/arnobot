-- Vervolg op 2026-11-19-ai-gebruik.sql: ook Voyage, transcriptie en audio in dezelfde tabel, zodat de kosten per gebruiker compleet zijn.
-- leverancier: 'anthropic' (standaard), 'voyage', 'openai', 'assemblyai'. Voor Voyage staan de tokens in invoer (model zegt of het
-- een embedding of de rerank is). Voor audio staat de duur in hoeveelheid met eenheid 'seconden'.
-- Uitvoeren in de Supabase SQL-editor. De Anthropic-rijen sturen deze kolommen niet mee en blijven dus gewoon werken, ook voordat dit
-- is uitgevoerd. Alleen de rijen van Voyage, OpenAI en AssemblyAI mislukken (met een logregel) tot de kolommen er zijn.

alter table arnobot_ai_gebruik add column if not exists leverancier text not null default 'anthropic';
alter table arnobot_ai_gebruik add column if not exists hoeveelheid numeric;
alter table arnobot_ai_gebruik add column if not exists eenheid text;

create index if not exists arnobot_ai_gebruik_leverancier_tijd on arnobot_ai_gebruik (leverancier, created_at);
