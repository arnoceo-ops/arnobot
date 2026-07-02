'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

import Link from 'next/link';

const SEGMENT_WEIGHTS = { mensen: 0.4, strategie: 0.3, uitvoering: 0.3 };
const SEGMENT_TOTALS  = { strategie: 39, mensen: 13, uitvoering: 44 };

const G  = 'Geist, system-ui, sans-serif';
const BN = 'Bebas Neue, sans-serif';

const ORANGE = '#f59e0b';
const GREY   = 'rgb(136, 136, 136)';
const CREAM  = '#f1f5f9';
const DARK   = '#111827';
const CARD   = '#0d0d0d';
const LINE   = '#1f1f1f';
const LINE2  = '#1e293b';

const RED    = '#c0392b';
const YELLOW = '#d4a017';
const GREEN  = '#2ecc71';

interface MemberStats {
  user_id: string;
  email: string;
  strategie_kwaliteit: number;
  mensen_kwaliteit: number;
  uitvoering_kwaliteit: number;
  plan_kwaliteit: number;
  strategie_voortgang: number;
  mensen_voortgang: number;
  uitvoering_voortgang: number;
  volledigheid: number;
}

interface QuestionAlignment {
  question_id: string;
  label: string;
  score: number;
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

/* ── Alignment colour helper ── */
function alignColor(pct: number) {
  if (pct >= 70) return GREEN;
  if (pct >= 45) return YELLOW;
  return RED;
}

function alignLabel(pct: number) {
  if (pct >= 70) return 'ALIGNED';
  if (pct >= 45) return 'MATIG';
  return 'DIVERGENT';
}

/* ── Single row: label + bar + percentage ── */
function Row({ label, value, barColor }: { label: string; value: number; barColor: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: G, fontSize: 13, fontWeight: 400, color: GREY }}>{label}</span>
        <span style={{ fontFamily: G, fontSize: 13, fontWeight: 400, color: CREAM }}>{value}%</span>
      </div>
      <div style={{ height: 2, background: LINE2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: barColor, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}


/* ── ArnoBot Alignment Chat — B ── */
function AlignmentChat({ result }: { result: AlignmentResult }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const context = `Team alignment resultaten:
Overall: ${result.overall}%
Strategie: ${result.strategie}% | Mensen: ${result.mensen}% | Uitvoering: ${result.uitvoering}%
Diagnose: ${result.summary ?? ''}
Vraag analyse: ${result.questions.slice(0, 5).map(q => q.label + ': ' + q.diagnose).join(' | ')}`;

  const send = async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setThinking(true);
    try {
      const res = await fetch('/api/canvas/alignment-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context, history: messages }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply ?? 'Geen antwoord.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Fout bij verbinding met ArnoBot.' }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div style={{ margin: '2px 40px 2px', background: '#0d0d0d', border: `0.5px solid ${LINE}` }}>
      <div style={{ padding: '20px 28px 16px', borderBottom: `1px solid ${LINE2}` }}>
        <div style={{ fontFamily: G, fontSize: 11, color: GREY, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>STEL EEN VRAAG</div>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ padding: '20px 28px', maxHeight: 320, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.role === 'user' ? ORANGE : '#1e293b',
              padding: '10px 16px',
            }}>
              <div style={{ fontFamily: G, fontSize: 13, color: m.role === 'user' ? DARK : CREAM, lineHeight: 1.5 }}>{m.text}</div>
            </div>
          ))}
          {thinking && (
            <div style={{ alignSelf: 'flex-start', background: '#1e293b', padding: '10px 16px' }}>
              <div style={{ fontFamily: G, fontSize: 13, color: GREY }}>ArnoBot denkt na...</div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '16px 28px 20px', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Wat kan ik doen met de divergentie op waardepropositie?"
          style={{
            flex: 1,
            maxWidth: 600,
            fontFamily: G,
            fontSize: 13,
            color: CREAM,
            background: '#1f2937',
            border: `1px solid ${LINE}`,
            padding: '10px 16px',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={thinking || !input.trim()}
          style={{
            fontFamily: BN,
            fontSize: 18,
            letterSpacing: '0.08em',
            color: DARK,
            background: thinking ? LINE : ORANGE,
            border: 'none',
            borderRadius: 8,
            padding: '12px 0',
            width: 200,
            cursor: thinking ? 'not-allowed' : 'pointer',
          }}
        >
          STUUR
        </button>
      </div>
    </div>
  );
}



/* ── PDF Download ── */
function downloadAlignmentPDF(result: AlignmentResult) {
  import('jspdf').then(({ jsPDF }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  let y = 20;

  const addText = (text: string, x: number, size: number, bold = false, color = [240, 237, 230] as [number,number,number]) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, y);
  };

  const newLine = (h = 8) => { y += h; };

  // Background
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, 297, 'F');

  // Title
  doc.setFontSize(28);
  doc.setTextColor(240, 237, 230);
  doc.text('TEAM ALIGNMENT RAPPORT', margin, y);
  newLine(8);
  doc.setFontSize(10);
  doc.setTextColor(136, 136, 136);
  doc.text(`Gegenereerd op ${new Date(result.calculated_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
  newLine(14);

  // Overall scores
  doc.setFontSize(48);
  doc.setTextColor(238, 119, 0);
  doc.text(`${result.overall}%`, margin, y);
  newLine(10);
  doc.setFontSize(10);
  doc.setTextColor(136, 136, 136);
  doc.text(`STRATEGIE: ${result.strategie}%   MENSEN: ${result.mensen}%   UITVOERING: ${result.uitvoering}%`, margin, y);
  newLine(6);
  if (result.summary) {
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    const summaryLines = doc.splitTextToSize(result.summary, W - margin * 2);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 5;
  }
  newLine(10);

  // Orange line
  doc.setDrawColor(238, 119, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  newLine(10);

  // Section: prioriteiten
  const segments = ['strategie', 'mensen', 'uitvoering'];
  const segLabels: Record<string, string> = { strategie: 'STRATEGIE', mensen: 'MENSEN', uitvoering: 'UITVOERING' };

  for (const seg of segments) {
    const segQuestions = [...result.questions]
      .filter(q => q.segment === seg)
      .sort((a, b) => a.score - b.score);
    if (!segQuestions.length) continue;

    if (y > 260) { doc.addPage(); doc.setFillColor(10,10,10); doc.rect(0,0,W,297,'F'); y = 20; }

    doc.setFontSize(16);
    doc.setTextColor(238, 119, 0);
    doc.text(segLabels[seg], margin, y);
    newLine(8);

    for (const q of segQuestions) {
      if (y > 270) { doc.addPage(); doc.setFillColor(10,10,10); doc.rect(0,0,W,297,'F'); y = 20; }
      const pct = Math.round(((q.score - 1) / 4) * 100);
      const r = pct < 45 ? 192 : pct < 70 ? 212 : 46;
      const g = pct < 45 ? 57 : pct < 70 ? 160 : 204;
      const b = pct < 45 ? 43 : pct < 70 ? 23 : 113;
      doc.setFontSize(9);
      doc.setTextColor(r, g, b);
      doc.text(`${pct}%`, margin, y);
      doc.setTextColor(240, 237, 230);
      const labelLines = doc.splitTextToSize(q.label, W - margin * 2 - 20);
      doc.text(labelLines, margin + 18, y);
      y += labelLines.length * 5;
      doc.setTextColor(136, 136, 136);
      const diagnoseLines = doc.splitTextToSize(q.diagnose, W - margin * 2 - 18);
      doc.text(diagnoseLines, margin + 18, y);
      y += diagnoseLines.length * 5 + 3;
    }
    newLine(6);
  }

  doc.save('alignment-rapport.pdf');
  });
}

/* ── Alignment Score Section ── */
function AlignmentScore({
  members,
  token,
}: {
  members: MemberStats[];
  token: string | null;
}) {
  const [result,    setResult]    = useState<AlignmentResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loadingCached, setLoadingCached] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Load cached result on mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/canvas/alignment', {
          headers: { 'x-supabase-token': token },
        });
        const data = await res.json();
        if (data.cached) setResult(data.cached);
      } catch { /* no cache */ }
      finally { setLoadingCached(false); }
    })();
  }, [token]);

  const analyse = useCallback(async () => {
    if (!token || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/canvas/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analyse mislukt');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, loading]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ borderBottom: `1px solid ${LINE}` }}>

      {/* Section header */}
      <div style={{ padding: '40px 40px 32px', borderBottom: `1px solid ${LINE2}` }}>
        <h2 style={{ fontFamily: BN, fontSize: 'clamp(32px,4vw,56px)' as any, fontWeight: 400, color: CREAM, margin: 0, letterSpacing: '0.02em' }}>
          ALIGNMENT ANALYSE
        </h2>
        {result && (
          <div style={{ fontFamily: G, fontSize: 11, color: GREY, marginTop: 6 }}>
            Laatste analyse: {formatDate(result.calculated_at)}
          </div>
        )}
        <button
          onClick={analyse}
          disabled={loading || members.length < 2}
          style={{
            fontFamily: BN,
            fontSize: 18,
            letterSpacing: '0.08em',
            color: loading ? GREY : DARK,
            background: loading ? LINE : ORANGE,
            border: 'none',
            borderRadius: 8,
            padding: '12px 0',
            width: 200,
            marginTop: 20,
            cursor: loading || members.length < 2 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: members.length < 2 ? 0.4 : 1,
          }}
        >
          {loading ? 'ANALYSEREN...' : result ? 'HERBEREKEN' : 'ANALYSEER TEAM'}
        </button>
      </div>

      {/* Loading state */}
      {loadingCached && (
        <div style={{ padding: '48px 40px', fontFamily: G, fontSize: 13, color: GREY }}>Laden...</div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '24px 40px', fontFamily: G, fontSize: 13, color: RED }}>{error}</div>
      )}

      {/* No result yet */}
      {!loadingCached && !result && !error && (
        <div style={{ padding: '48px 40px' }}>
          <div style={{ fontFamily: G, fontSize: 13, color: GREY, maxWidth: 480 }}>
            Klik op "Analyseer Team" om de mate van alignment tussen teamleden te berekenen.
            ArnoBot analyseert de antwoorden per vraag en bepaalt waar het team op één lijn zit
            en waar de meningen uiteenlopen.
          </div>
          {members.length < 2 && (
            <div style={{ fontFamily: G, fontSize: 12, color: YELLOW, marginTop: 12 }}>
              ⚠ Minimaal 2 teamleden met ingevulde antwoorden nodig.
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && !loadingCached && (
        <div>
          {/* Overall + segment scores */}
          <div style={{ padding: '40px 40px 48px', borderBottom: `1px solid ${LINE2}`, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 80px', alignItems: 'center' }}>

            {/* Big score */}
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontFamily: BN, fontSize: 'clamp(80px,12vw,160px)' as any, fontWeight: 400, lineHeight: 1, color: alignColor(result.overall) }}>
                {result.overall}%
              </div>
              <div style={{ fontFamily: G, fontSize: 11, letterSpacing: '0.12em', color: alignColor(result.overall), marginTop: 4 }}>
                TEAM {alignLabel(result.overall)}
              </div>
            </div>

            {/* Segment bars */}
            <div style={{ maxWidth: 480 }}>
              <div style={{ marginBottom: 28 }}>
                <Row label="STRATEGIE"  value={result.strategie}  barColor={alignColor(result.strategie)} />
                <Row label="MENSEN"     value={result.mensen}     barColor={alignColor(result.mensen)} />
                <Row label="UITVOERING" value={result.uitvoering} barColor={alignColor(result.uitvoering)} />
              </div>
              <div style={{ fontFamily: G, fontSize: 11, color: GREY, lineHeight: 1.6 }}>
                Gewogen score (Mensen 40%, Strategie 30%, Uitvoering 30%).
                Groen ≥70% · Oranje 45-69% · Rood &lt;45%
              </div>
            </div>
          </div>

                     {/* ArnoBot + ArnoLive — side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>

            {/* ArnoBot — A+B */}
            <div style={{ background: '#0d0d0d', border: `0.5px solid ${LINE}` }}>
              <div style={{ padding: '28px 40px 20px', borderBottom: `1px solid ${LINE2}` }}>
                <div style={{ fontFamily: BN, fontSize: 56, fontWeight: 400, color: CREAM, letterSpacing: '0.02em', lineHeight: 1 }}>ARNOBOT</div>
                <div style={{ fontFamily: G, fontSize: 13, fontWeight: 400, color: GREY, marginTop: 6 }}>ADVIES VAN ARNOBOT</div>
              </div>
              {result.summary && (
                <div style={{ padding: '20px 40px 24px', borderBottom: `1px solid ${LINE2}` }}>
                  <div style={{ fontFamily: G, fontSize: 13, color: CREAM, lineHeight: 1.6, fontStyle: 'italic' as const }}>{result.summary}</div>
                </div>
              )}
              <AlignmentChat result={result} />
            </div>

            {/* ArnoLive — C */}
            <div style={{ background: '#0d0d0d', border: `0.5px solid ${LINE}`, display: 'flex', flexDirection: 'column' as const }}>
              <div style={{ padding: '28px 40px 20px', borderBottom: `1px solid ${LINE2}` }}>
                <div style={{ fontFamily: BN, fontSize: 56, fontWeight: 400, color: CREAM, letterSpacing: '0.02em', lineHeight: 1 }}>ARNOLIVE</div>
                <div style={{ fontFamily: G, fontSize: 13, fontWeight: 400, color: GREY, marginTop: 6 }}>ADVIES VAN ARNOLIVE</div>
              </div>
              <div style={{ padding: '20px 40px 24px', borderBottom: `1px solid ${LINE2}` }}>
                <div style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  ARNO LIVE IN STELLING BRENGEN?
                </div>
              </div>
              <div style={{ padding: '16px 40px 20px' }}>
                <a
                  href="mailto:arno@royaldutchsales.com?subject=ArnoLive%20aanvraag&amp;body=Ik%20wil%20graag%20de%20alignment%20resultaten%20bespreken."
                  style={{ fontFamily: BN, fontSize: 18, letterSpacing: '0.08em', color: DARK, background: ORANGE, padding: '12px 0', borderRadius: 8, width: 200, textDecoration: 'none', display: 'inline-block', textAlign: 'center' as const }}
                >
                  BOEK ARNOLIVE
                </a>
              </div>
            </div>
          </div>


          {/* Question breakdown — top 5 best + top 5 worst */}
          {result.questions.length > 0 && (<>
            <div style={{ height: 2, background: '#f59e0b', margin: '2px 0' }} />
            <div style={{ padding: '32px 40px 40px' }}>

              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: G, fontSize: 11, fontWeight: 400, letterSpacing: '0.08em', color: GREY, textTransform: 'uppercase' as const }}>
                  VRAAG ANALYSE: {result.questions.length} VRAGEN GEANALYSEERD
                </div>
              </div>

              {/* Top 5 worst aligned */}
              <div style={{ fontFamily: G, fontSize: 11, color: GREY, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
                AANDACHTSPUNTEN: LAAGSTE ALIGNMENT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 2, marginBottom: 32 }}>
                {result.questions.slice(0, 5).map((q) => {
                  const pct = Math.round(((q.score - 1) / 4) * 100);
                  const col = alignColor(pct);
                  return (
                    <div key={q.question_id} style={{ background: CARD, border: `0.5px solid ${LINE}`, padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ fontFamily: G, fontSize: 10, color: GREY, letterSpacing: '0.08em' }}>{q.segment.toUpperCase()}</div>
                        <div style={{ fontFamily: BN, fontSize: 28, color: col, lineHeight: 1 }}>{pct}%</div>
                      </div>
                      <div style={{ fontFamily: G, fontSize: 13, color: CREAM, marginBottom: 8, lineHeight: 1.4 }}>{q.label}</div>
                      <div style={{ height: 2, background: LINE2, marginBottom: 10 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: col, transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ fontFamily: G, fontSize: 11, color: GREY, fontStyle: 'italic' as const }}>{q.diagnose}</div>
                    </div>
                  );
                })}
              </div>

              {/* Top 5 best aligned */}
              <div style={{ fontFamily: G, fontSize: 11, color: GREY, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
                STERKSTE ALIGNMENT: GEDEELDE KRACHT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 2 }}>
                {[...result.questions].sort((a, b) => b.score - a.score).slice(0, 5).map((q) => {
                  const pct = Math.round(((q.score - 1) / 4) * 100);
                  const col = alignColor(pct);
                  return (
                    <div key={q.question_id} style={{ background: CARD, border: `0.5px solid ${LINE}`, padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ fontFamily: G, fontSize: 10, color: GREY, letterSpacing: '0.08em' }}>{q.segment.toUpperCase()}</div>
                        <div style={{ fontFamily: BN, fontSize: 28, color: col, lineHeight: 1 }}>{pct}%</div>
                      </div>
                      <div style={{ fontFamily: G, fontSize: 13, color: CREAM, marginBottom: 8, lineHeight: 1.4 }}>{q.label}</div>
                      <div style={{ height: 2, background: LINE2, marginBottom: 10 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: col, transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ fontFamily: G, fontSize: 11, color: GREY, fontStyle: 'italic' as const }}>{q.diagnose}</div>
                    </div>
                  );
                })}
              </div>

              {/* Download button */}
              <div style={{ marginTop: 32 }}>
                <button
                  onClick={() => downloadAlignmentPDF(result)}
                  style={{ fontFamily: BN, fontSize: 18, letterSpacing: '0.08em', color: DARK, background: ORANGE, border: 'none', borderRadius: 8, padding: '12px 0', width: 200, cursor: 'pointer' }}
                >
                  DOWNLOAD PDF
                </button>
              </div>

            </div>
            <div style={{ height: 2, background: ORANGE }} />
          </>)}
        </div>
      )}
    </div>
  );
}

/* ── Member card ── */
function MemberCard({ member, rank }: { member: MemberStats; rank: number }) {
  const isTop = rank === 1;
  const kwaliteitLabel = member.plan_kwaliteit >= 70 ? 'STERK' : member.plan_kwaliteit >= 50 ? 'MATIG' : 'ZWAK';

  return (
    <div style={{ background: CARD, border: `0.5px solid ${isTop ? GREY : LINE}`, position: 'relative' as const }}>
      {isTop && <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2, background: GREY }} />}

      <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${LINE2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY, marginBottom: 4 }}>#{rank}</div>
          <div style={{ fontFamily: G, fontSize: 13, fontWeight: 400, color: CREAM, maxWidth: 220, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
            {member.email}
          </div>
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ fontFamily: BN, fontSize: 64, fontWeight: 400, lineHeight: 0.85, color: CREAM }}>
            {member.plan_kwaliteit}%
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY }}>PLAN KWALITEIT&nbsp;</span>
            <span style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: ORANGE }}>{kwaliteitLabel}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ padding: '20px 28px', borderRight: `1px solid ${LINE2}` }}>
          <div style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY, letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' as const }}>VOORTGANG</div>
          <Row label="Strategie"  value={member.strategie_voortgang}  barColor={ORANGE} />
          <Row label="Mensen"     value={member.mensen_voortgang}     barColor={ORANGE} />
          <Row label="Uitvoering" value={member.uitvoering_voortgang} barColor={ORANGE} />
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${LINE2}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY }}>TOTAAL</span>
            <span style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: CREAM }}>{member.volledigheid}%</span>
          </div>
        </div>
        <div style={{ padding: '20px 28px' }}>
          <div style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY, letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' as const }}>KWALITEIT</div>
          <Row label="Strategie"  value={member.strategie_kwaliteit}  barColor={ORANGE} />
          <Row label="Mensen"     value={member.mensen_kwaliteit}     barColor={ORANGE} />
          <Row label="Uitvoering" value={member.uitvoering_kwaliteit} barColor={ORANGE} />
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${LINE2}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: GREY }}>TOTAAL</span>
            <span style={{ fontFamily: G, fontSize: 11, fontWeight: 400, color: CREAM }}>{member.plan_kwaliteit}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Team averages block ── */
function TeamAverages({ members }: { members: MemberStats[] }) {
  if (members.length === 0) return null;
  const avg = (key: keyof MemberStats) =>
    Math.round(members.reduce((s, m) => s + (m[key] as number), 0) / members.length);

  const row1 = [
    { key: 'plan_kwaliteit' as const, lbl: 'PLAN KWALITEIT' },
    { key: 'volledigheid'   as const, lbl: 'VOLLEDIGHEID'   },
  ];
  const row2 = [
    { key: 'strategie_kwaliteit'  as const, lbl: 'STRATEGIE'  },
    { key: 'mensen_kwaliteit'     as const, lbl: 'MENSEN'      },
    { key: 'uitvoering_kwaliteit' as const, lbl: 'UITVOERING'  },
  ];

  const StatCell = ({ k, lbl, last, variant = 'secondary' }: { k: keyof MemberStats; lbl: string; last?: boolean; variant?: 'primary' | 'secondary' }) => (
    <div style={{ borderRight: last ? 'none' : `1px solid ${LINE2}`, paddingRight: last ? 0 : 48, marginRight: last ? 0 : 48 }}>
      <div style={{ fontFamily: G, fontSize: 13, fontWeight: 400, letterSpacing: '0.05em', color: variant === 'primary' ? CREAM : GREY, marginBottom: 8, textTransform: 'uppercase' as const }}>{lbl}</div>
      <div style={{ fontFamily: BN, fontSize: 120, fontWeight: 400, lineHeight: 1, color: variant === 'primary' ? ORANGE : CREAM }}>{avg(k)}%</div>
    </div>
  );

  return (
    <div style={{ borderBottom: `1px solid ${LINE}`, padding: '40px 40px 48px' }}>
      <div style={{ fontFamily: G, fontSize: 13, fontWeight: 400, letterSpacing: '0.05em', color: GREY, marginBottom: 40, textTransform: 'uppercase' as const }}>
        TEAM GEMIDDELDE: {members.length} {members.length === 1 ? 'LID' : 'LEDEN'}
      </div>
      <div style={{ display: 'flex', marginBottom: 48 }}>
        {row1.map((s, i) => <StatCell key={s.lbl} k={s.key} lbl={s.lbl} last={i === row1.length - 1} variant="primary" />)}
      </div>
      <div style={{ display: 'flex' }}>
        {row2.map((s, i) => <StatCell key={s.lbl} k={s.key} lbl={s.lbl} last={i === row2.length - 1} variant="secondary" />)}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function TeamPage() {
  const { userId, getToken } = useAuth();
  const [members,  setMembers]  = useState<MemberStats[]>([]);
  const [token,    setToken]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const loadTeamData = useCallback(async () => {
    if (!userId) return;
    try {
      const t = await getToken({ template: 'supabase' });
      setToken(t);

      const res = await fetch('/api/canvas/team');
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Geen toegang. Dit dashboard is alleen beschikbaar voor managers.');
        setLoading(false);
        return;
      }
      const { approvedUsers, answers } = await res.json();

      const stats: MemberStats[] = approvedUsers.map((user: { user_id: string; email: string }) => {
        const ua = answers?.filter((a: { user_id: string }) => a.user_id === user.user_id) ?? [];

        const segKwaliteit = (seg: string) => {
          const sa = ua.filter((a: { question_id: string; score: number | null }) => a.question_id.startsWith(seg) && a.score !== null);
          if (!sa.length) return 0;
          return Math.round((sa.reduce((s: number, a: { score: number }) => s + (a.score ?? 0), 0) / sa.length / 5) * 100);
        };

        const segVoortgang = (seg: string) => {
          const filled = ua.filter((a: { question_id: string; answer: string }) => a.question_id.startsWith(seg) && a.answer && a.answer.trim() !== '').length;
          const total  = SEGMENT_TOTALS[seg as keyof typeof SEGMENT_TOTALS] ?? 1;
          return Math.round((filled / total) * 100);
        };

        const strategie_kwaliteit  = segKwaliteit('strategie');
        const mensen_kwaliteit     = segKwaliteit('mensen');
        const uitvoering_kwaliteit = segKwaliteit('uitvoering');

        const plan_kwaliteit = Math.round(
          strategie_kwaliteit  * SEGMENT_WEIGHTS.strategie +
          mensen_kwaliteit     * SEGMENT_WEIGHTS.mensen +
          uitvoering_kwaliteit * SEGMENT_WEIGHTS.uitvoering
        );

        const strategie_voortgang  = segVoortgang('strategie');
        const mensen_voortgang     = segVoortgang('mensen');
        const uitvoering_voortgang = segVoortgang('uitvoering');

        const answered     = ua.filter((a: { answer: string }) => a.answer && a.answer.trim() !== '').length;
        const volledigheid = Math.round((answered / 96) * 100);

        return {
          user_id: user.user_id, email: user.email,
          strategie_kwaliteit, mensen_kwaliteit, uitvoering_kwaliteit, plan_kwaliteit,
          strategie_voortgang, mensen_voortgang, uitvoering_voortgang, volledigheid,
        };
      });

      stats.sort((a: MemberStats, b: MemberStats) => b.plan_kwaliteit - a.plan_kwaliteit);
      setMembers(stats);
    } catch (err) { console.error(err); setError('Fout bij laden teamdata.'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadTeamData(); }, [loadTeamData]);

  return (
    <div style={{ minHeight: '100vh', background: DARK, color: CREAM }}>

      <nav style={{ position: 'sticky' as const, top: 0, zIndex: 100, background: '#f5f0e8', borderBottom: '1px solid #e0d8cc', padding: '0 40px', display: 'flex', alignItems: 'center', height: 103, fontFamily: 'var(--font-bebas), sans-serif', fontSize: 36, letterSpacing: '3px' }}>
        <Link href="/canvas" style={{ fontFamily: BN, fontSize: 36, letterSpacing: '3px', color: '#1a1714', textDecoration: 'none', opacity: 0.4 }}>← CANVAS</Link>
      </nav>

      <div style={{ borderBottom: `1px solid ${LINE}`, padding: '48px 40px 40px' }}>
        <div style={{ fontFamily: G, fontSize: 13, fontWeight: 400, letterSpacing: '0.05em', color: ORANGE, marginBottom: 8, textTransform: 'uppercase' as const }}>
          ROYAL DUTCH SALES
        </div>
        <h1 style={{ fontFamily: BN, fontSize: 'clamp(48px, 7vw, 96px)' as any, fontWeight: 400, letterSpacing: '0.02em', color: CREAM, margin: 0, lineHeight: 1 }}>
          TEAM DASHBOARD
        </h1>
        <p style={{ fontFamily: G, fontSize: 13, fontWeight: 400, color: GREY, marginTop: 12, letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>
          VERGELIJK PLAN KWALITEIT EN VOORTGANG PER TEAMLID
        </p>
      </div>

      {!loading && !error && <TeamAverages members={members} />}

      {!loading && !error && (
        <><div style={{ height: 2, background: '#f59e0b' }} /><AlignmentScore members={members} token={token} /></>
      )}

      {loading && <div style={{ fontFamily: G, fontSize: 13, color: GREY, textAlign: 'center' as const, padding: '80px 0' }}>Laden...</div>}
      {error   && <div style={{ fontFamily: G, fontSize: 13, color: RED,  textAlign: 'center' as const, padding: '80px 0' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ padding: '40px' }}>
          <div style={{ fontFamily: G, fontSize: 11, fontWeight: 400, letterSpacing: '0.08em', color: GREY, marginBottom: 24, textTransform: 'uppercase' as const }}>
            TEAMLEDEN: GESORTEERD OP PLAN KWALITEIT
          </div>
          {members.length === 0
            ? <div style={{ fontFamily: G, fontSize: 13, color: GREY, textAlign: 'center' as const, padding: '80px 0' }}>Geen teamleden gevonden.</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))', gap: 2 }}>
                {members.map((member, i) => <MemberCard key={member.user_id} member={member} rank={i + 1} />)}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
