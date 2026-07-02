import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Service role client — bypasses RLS for manager reads
const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Question labels — alle 72 echte question_ids
const QUESTION_LABELS: Record<string, string> = {
  // MENSEN
  'mensen_aantrekkingskracht':       'Hoe trekt u de beste verkopers aan?',
  'mensen_behoud_sterspelers':       'Hoe behoudt u uw sterspelers?',
  'mensen_profielen':                'Welke verkoopprofielen heeft u nodig?',
  'mensen_selectieproces':           'Hoe ziet uw selectieproces eruit?',
  'mensen_verkopers_q2_aantal':      'Hoeveel verkopers heeft u in Q2?',
  'mensen_verkopers_q2_blijven':     'Hoeveel verkopers blijven in Q2?',
  'mensen_verkopers_q2_nieuw':       'Hoeveel nieuwe verkopers in Q2?',
  'mensen_verkopers_q2_uitbreiding': 'Wat is uw uitbreidingsplan Q2?',
  // STRATEGIE
  'strategie_acties_brutomarge':     'Welke actie verbetert de brutomarge?',
  'strategie_acties_cash':           'Welke actie verbetert de cashpositie?',
  'strategie_acties_datum':          'Wanneer voert u de acties uit?',
  'strategie_acties_klanten':        'Welke actie trekt meer klanten?',
  'strategie_acties_omzet':          'Welke actie verhoogt de omzet?',
  'strategie_acties_winst':          'Welke actie verhoogt de winst?',
  'strategie_cultuur_1':             'Welke cultuurwaarde staat op 1?',
  'strategie_cultuur_2':             'Welke cultuurwaarde staat op 2?',
  'strategie_cultuur_3':             'Welke cultuurwaarde staat op 3?',
  'strategie_cultuur_4':             'Welke cultuurwaarde staat op 4?',
  'strategie_cultuur_5':             'Welke cultuurwaarde staat op 5?',
  'strategie_dienstverlening':       'Hoe omschrijft u uw dienstverlening?',
  'strategie_doelen_datum':          'Wanneer bereikt u uw doelen?',
  'strategie_doelen_klanten':        'Hoeveel klanten is het doel?',
  'strategie_doelen_liquiditeit':    'Wat is het liquiditeitsdoel?',
  'strategie_doelen_marktaandeel':   'Wat is het marktaandeeldoel?',
  'strategie_doelen_omzet':          'Wat is het omzetdoel?',
  'strategie_doelen_winst':          'Wat is het winstdoel?',
  'strategie_kerncompetenties':      'Wat zijn uw kerncompetenties?',
  'strategie_klantretentie':         'Hoe verbetert u klantretentie?',
  'strategie_leiderschap_markten':   'In welke markten wilt u leider worden?',
  'strategie_leiderschap_wanneer':   'Wanneer wilt u marktleider zijn?',
  'strategie_merkbelofte':           'Wat is uw merkbelofte?',
  'strategie_missie':                'Wat is de missie van uw organisatie?',
  'strategie_moonshots':             'Wat zijn uw moonshots?',
  'strategie_omtm':                  'Wat is uw One Metric That Matters?',
  'strategie_onderscheidend_1':      'Wat maakt u onderscheidend (1)?',
  'strategie_onderscheidend_2':      'Wat maakt u onderscheidend (2)?',
  'strategie_onderscheidend_3':      'Wat maakt u onderscheidend (3)?',
  'strategie_onderscheidend_4':      'Wat maakt u onderscheidend (4)?',
  'strategie_onderscheidend_5':      'Wat maakt u onderscheidend (5)?',
  'strategie_referrals':             'Hoe genereert u referrals?',
  'strategie_repeterende_omzet':     'Hoe bouwt u repeterende omzet?',
  'strategie_schaalbaarheid':        'Hoe maakt u uw model schaalbaar?',
  'strategie_strategie_1_zin':       'Wat is uw strategie in één zin?',
  'strategie_waardepropositie':      'Wat is uw waardepropositie?',
  'strategie_winst_per_eenheid':     'Wat is uw winst per eenheid?',
  'strategie_xfactor':               'Wat is uw X-factor?',
  'strategie_zandbak':               'Wat is uw zandbak (speelveld)?',
  // UITVOERING — KPIs
  'uitvoering_kpi_conversieratio_doel':  'Wat is het doel conversieratio?',
  'uitvoering_kpi_conversieratio_real':  'Wat is het werkelijke conversieratio?',
  'uitvoering_kpi_forecast_doel':        'Wat is het forecast doel?',
  'uitvoering_kpi_forecast_real':        'Wat is de werkelijke forecast?',
  'uitvoering_kpi_klantaandeel_doel':    'Wat is het doel klantaandeel?',
  'uitvoering_kpi_klantaandeel_real':    'Wat is het werkelijke klantaandeel?',
  'uitvoering_kpi_klantretentie_doel':   'Wat is het doel klantretentie?',
  'uitvoering_kpi_klantretentie_real':   'Wat is de werkelijke klantretentie?',
  'uitvoering_kpi_nieuwe_logos_doel':    'Wat is het doel nieuwe logos?',
  'uitvoering_kpi_nieuwe_logos_real':    'Hoeveel nieuwe logos zijn er werkelijk?',
  'uitvoering_kpi_omzet_doel':           'Wat is het omzetdoel?',
  'uitvoering_kpi_omzet_real':           'Wat is de werkelijke omzet?',
  'uitvoering_kpi_ordergrootte_doel':    'Wat is het doel ordergrootte?',
  'uitvoering_kpi_ordergrootte_real':    'Wat is de werkelijke ordergrootte?',
  'uitvoering_kpi_referrals_doel':       'Wat is het doel referrals?',
  'uitvoering_kpi_referrals_real':       'Hoeveel referrals zijn er werkelijk?',
  'uitvoering_kpi_verkoopcyclus_doel':   'Wat is het doel verkoopcyclus?',
  'uitvoering_kpi_verkoopcyclus_real':   'Wat is de werkelijke verkoopcyclus?',
  'uitvoering_kpi_winst_doel':           'Wat is het winstdoel?',
  'uitvoering_kpi_winst_real':           'Wat is de werkelijke winst?',
  // UITVOERING — Numbers
  'uitvoering_numbers_bezoeken':    'Hoeveel bezoeken zijn er gepland?',
  'uitvoering_numbers_leads':       'Hoeveel leads zijn er gegenereerd?',
  'uitvoering_numbers_offertes':    'Hoeveel offertes zijn er uitgebracht?',
  'uitvoering_numbers_orders':      'Hoeveel orders zijn er binnengekomen?',
  'uitvoering_numbers_referrals':   'Hoeveel referrals zijn er gegenereerd?',
};

interface AnswerRow {
  user_id: string;
  question_id: string;
  answer: string;
  score: number | null;
}

interface QuestionAlignment {
  question_id: string;
  label: string;
  score: number;       // 1–5
  diagnose: string;
  segment: string;
}

interface AlignmentResult {
  overall: number;
  strategie: number;
  mensen: number;
  uitvoering: number;
  questions: QuestionAlignment[];
  calculated_at: string;
  summary?: string;
}

async function analyseQuestion(questionId: string, answers: string[]): Promise<{ score: number; diagnose: string }> {
  const label = QUESTION_LABELS[questionId] ?? questionId;
  const answersText = answers.map((a, i) => `Lid ${i + 1}: "${a}"`).join('\n');

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Je analyseert de mate van alignment binnen een salesteam. Beoordeel op INHOUDELIJKE overlap, niet op formulering. Verschillende woorden voor hetzelfde concept zijn waardevol en verdienen een hoge score. Het gaat om gedeelde intentie en betekenis, niet om identieke tekst.

Vraag: "${label}"

Antwoorden van ${answers.length} teamleden:
${answersText}

Geef een alignment score van 1–5 op basis van INHOUDELIJKE overeenkomst:
1 = fundamenteel tegenstrijdig, tegengestelde visies
2 = weinig inhoudelijke overlap, duidelijk verschillende prioriteiten
3 = gedeeltelijke overlap, gemeenschappelijke basis maar ook echte verschillen
4 = sterke inhoudelijke overlap, zelfde richting met eigen nuance. Dit is waardevol (1+1=5)
5 = volledig op één lijn, zelfde intentie en betekenis ook al zijn woorden anders

Belangrijk: score 4 of 5 als teamleden hetzelfde bedoelen maar anders formuleren. Dat is een teken van een sterk team dat vanuit meerdere invalshoeken naar hetzelfde kijkt.

Geef ook een korte diagnose (max 12 woorden in het Nederlands). Bij score 4-5: benoem de gedeelde kracht positief.

Reageer ALLEEN met valid JSON, geen markdown, geen uitleg:
{"score": 4, "diagnose": "Team deelt dezelfde visie, verschillende perspectieven verrijken het geheel"}`
    }]
  });

  const text = msg.content.find(b => b.type === 'text')?.text ?? '{"score":3,"diagnose":"Onvoldoende data"}';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { score: 3, diagnose: 'Analyse niet beschikbaar' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

    // Get Supabase token from request body (passed from client)
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Geen token' }, { status: 400 });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Verify manager (serviceDb — bypasses RLS so the check always works)
    const { data: managerCheck } = await serviceDb
      .from('approved_users')
      .select('is_manager')
      .eq('user_id', userId)
      .single();

    if (!managerCheck?.is_manager) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Fetch all answers (service role — bypasses RLS)
    const { data: answers, error: ae } = await serviceDb
      .from('canvas_answers')
      .select('user_id, question_id, answer, score');

    if (ae || !answers) throw ae;

    // Group answers by question_id, filter for questions with 2+ non-empty answers
    const byQuestion: Record<string, string[]> = {};
    (answers as AnswerRow[]).forEach(row => {
      if (row.answer && row.answer.trim() !== '') {
        if (!byQuestion[row.question_id]) byQuestion[row.question_id] = [];
        byQuestion[row.question_id].push(row.answer.trim());
      }
    });

    // Only analyse questions we have labels for AND have 2+ answers
    const eligibleIds = Object.entries(byQuestion)
      .filter(([qid, ans]) => QUESTION_LABELS[qid] && ans.length >= 2)
      .map(([qid]) => qid);

    if (eligibleIds.length === 0) {
      return NextResponse.json({ error: 'Onvoldoende teamdata voor analyse (minimaal 2 teamleden met ingevulde antwoorden)' }, { status: 400 });
    }

    // Analyse all eligible questions (parallel, max 6 at a time to avoid rate limits)
    const results: QuestionAlignment[] = [];
    const chunks = [];
    for (let i = 0; i < eligibleIds.length; i += 6) chunks.push(eligibleIds.slice(i, i + 6));

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (qid) => {
          const { score, diagnose } = await analyseQuestion(qid, byQuestion[qid]);
          const segment = qid.split('_')[0];
          return {
            question_id: qid,
            label: QUESTION_LABELS[qid],
            score,
            diagnose,
            segment,
          };
        })
      );
      results.push(...chunkResults);
    }

    // Calculate segment averages (convert 1–5 to 0–100%)
    const segmentScore = (seg: string) => {
      const sq = results.filter(r => r.segment === seg);
      if (!sq.length) return 0;
      return Math.round(((sq.reduce((s, r) => s + r.score, 0) / sq.length) - 1) / 4 * 100);
    };

    const strategie  = segmentScore('strategie');
    const mensen     = segmentScore('mensen');
    const uitvoering = segmentScore('uitvoering');

    // Weighted overall (same weights as health score)
    const overall = Math.round(strategie * 0.3 + mensen * 0.4 + uitvoering * 0.3);

    const alignmentResult: AlignmentResult = {
      overall, strategie, mensen, uitvoering,
      questions: results.sort((a, b) => a.score - b.score), // worst first
      calculated_at: new Date().toISOString(),
    };

    // Generate ArnoBot summary
    const summaryMsg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Je bent ArnoBot, een provocerende en ongefilterde sales coach van Royal Dutch Sales. Schrijf een korte maar krachtige analyse van de team alignment resultaten hieronder. Wees direct, eerlijk, en gebruik de taal van een ervaren sales strateeg. Geen wollige taal. Max 60 woorden. Nederlands.

Overall alignment: ${overall}%
Strategie: ${strategie}% | Mensen: ${mensen}% | Uitvoering: ${uitvoering}%

Top divergente vragen:
${results.slice(0, 3).map(q => `- ${q.label}: ${q.diagnose}`).join('\n')}

Geef een diagnose en één concrete aanbeveling. Spreek de manager direct aan met "jouw team".`
      }]
    });
    const summaryBlock = summaryMsg.content.find((b) => b.type === 'text');
    const summary = summaryBlock && 'text' in summaryBlock ? summaryBlock.text : '';
    const alignmentResultWithSummary: AlignmentResult = {
      ...alignmentResult,
      summary,
    };

    // Cache in Supabase (upsert on manager user_id)
    await serviceDb.from('canvas_alignment').upsert({
      user_id: userId,
      result: alignmentResultWithSummary,
      calculated_at: alignmentResultWithSummary.calculated_at,
    }, { onConflict: 'user_id' });

    return NextResponse.json(alignmentResultWithSummary);
  } catch (err) {
    console.error('Alignment error:', err);
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

    const token = req.headers.get('x-supabase-token');
    if (!token) return NextResponse.json({ error: 'Geen token' }, { status: 400 });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data } = await serviceDb
      .from('canvas_alignment')
      .select('result, calculated_at')
      .eq('user_id', userId)
      .single();

    if (!data) return NextResponse.json({ cached: null });
    return NextResponse.json({ cached: data.result });
  } catch {
    return NextResponse.json({ cached: null });
  }
}
