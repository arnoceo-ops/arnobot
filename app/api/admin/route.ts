import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_ID = process.env.ADMIN_USER_ID
if (!ADMIN_ID) console.error('ADMIN_USER_ID env var not set')

export async function POST(req: NextRequest) {
  try {
    const { userId: _ignored, email } = await req.json()
    const { userId } = await auth()

    if (!userId || userId !== ADMIN_ID) {
      return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || typeof email !== 'string' || !emailRegex.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
    }

    // Invite via Clerk
    const clerk = await clerkClient()
    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-up`,
    })

    // Sla op in invites tabel
    await supabaseAdmin.from('invites').insert({
      email,
      invited_by: userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Uitnodiging mislukt.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId || userId !== ADMIN_ID) {
      return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
    }

    // Haal alle users op via Clerk
    const clerk = await clerkClient()
    const { data: users } = await clerk.users.getUserList({ limit: 100 })

    // Haal alle canvas antwoorden op
    const allUserIds = users.map(u => u.id)

    const ALL_FIELDS = {
      strategie: 41,
      mensen: 21,
      uitvoering: 20,
    }
    const TOTAL = 82

    const { data: answers } = await supabaseAdmin
      .from('canvas_answers')
      .select('user_id, question_id, answer')
      .in('user_id', allUserIds)

    // Bereken health score per user
    const userScores = users.map(u => {
      const userAnswers = (answers || []).filter(a => a.user_id === u.id && a.answer?.trim())
      const filled = userAnswers.length
      const healthScore = Math.round((filled / TOTAL) * 100)

      const strategie = userAnswers.filter(a => a.question_id.startsWith('strategie_')).length
      const mensen = userAnswers.filter(a => a.question_id.startsWith('mensen_')).length
      const uitvoering = userAnswers.filter(a => a.question_id.startsWith('uitvoering_')).length

      return {
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.emailAddresses[0]?.emailAddress,
        email: u.emailAddresses[0]?.emailAddress,
        healthScore,
        scores: { strategie, mensen, uitvoering },
        totals: ALL_FIELDS,
        createdAt: u.createdAt,
      }
    })

    return NextResponse.json({ users: userScores })
  } catch (error) {
    console.error('Admin GET error:', error)
    return NextResponse.json({ error: 'Ophalen mislukt.' }, { status: 500 })
  }
}
