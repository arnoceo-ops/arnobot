// Loopt het grootboek van het referraltegoed nog mee (regels zonder gevolgen), of telt het echt? Los bestand, zodat ook
// de kleine vragen vanuit de betaalverwerking het kunnen lezen. Wordt pas false bij de livegang van het grootboek
// (docs/REFERRAL_BOUWPLAN_R3.md, B5); tot dan bestaan er geen echte regels en wordt er geen tegoed verrekend.
export const MEELOOP = true
