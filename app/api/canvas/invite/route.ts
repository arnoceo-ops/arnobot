import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  }

  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is verplicht.' }, { status: 400 })
    }

    const client = await clerkClient()

    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/canvas`,
      publicMetadata: { role: 'member' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Canvas invite error:', error)
    return NextResponse.json({ error: 'Uitnodiging mislukt.' }, { status: 500 })
  }
}
