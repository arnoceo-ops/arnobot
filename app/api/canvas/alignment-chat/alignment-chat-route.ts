import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

    const { message, context, history } = await req.json();

    const systemPrompt = `Je bent ArnoBot — de ongefilterde, provocerende sales coach van Royal Dutch Sales. Je spreekt managers direct aan. Je geeft concrete, bruikbare adviezen gebaseerd op de alignment data. Geen wollige taal, geen omwegen. Je bent eerlijk, soms confronterend, maar altijd constructief. Max 80 woorden per antwoord. Nederlands.

Huidige team alignment context:
${context}`;

    const historyMessages = (history ?? []).map((m: { role: string; text: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.text,
    }));

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        ...historyMessages,
        { role: 'user', content: message },
      ],
    });

    const reply = msg.content.find(b => b.type === 'text')?.text ?? '';
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Alignment chat error:', err);
    return NextResponse.json({ error: 'Chat mislukt' }, { status: 500 });
  }
}
