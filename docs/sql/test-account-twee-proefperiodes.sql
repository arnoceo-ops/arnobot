-- Test van /bot/herstart voor "twee proefperiodes gehad, nog binnen 12 maanden":
-- zet test@arno.bot in de toestand van iemand die twee gratis proefperiodes had, niet betaalde,
-- en wiens tweede proefperiode 30 dagen geleden eindigde. Log daarna in via /testlogin en ga naar
-- /bot/herstart: je ziet "JE KENT ARNOBOT AL." en het menu is ingekort tot ACCOUNT, SUPPORT en
-- UITLOGGEN. /bot/doorgaan toont "Je proefperiode zit erop.".
update approved_users set
  is_active = false,
  deactivated_at = now() - interval '30 days',
  trial_reactivated_at = now() - interval '75 days',
  winback_sent_at = now() - interval '120 days',
  paid_at = null,
  expires_at = null
where user_id = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D';

-- Variant: de 12 maanden zijn voorbij (verwacht: "WELKOM TERUG." met knop START 30-DAAGSE TRIAL).
-- update approved_users set deactivated_at = now() - interval '370 days'
-- where user_id = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D';

-- HERSTEL na de test (verplicht, anders blijft het testaccount buitengesloten, zie
-- lib/internalTestAccounts.ts):
-- update approved_users set
--   is_active = true,
--   deactivated_at = null,
--   trial_reactivated_at = null,
--   winback_sent_at = null,
--   expires_at = '2035-01-01T00:00:00Z'
-- where user_id = 'user_3HFvMfJ8ztQxatkJg3SWdSJPz4D';
