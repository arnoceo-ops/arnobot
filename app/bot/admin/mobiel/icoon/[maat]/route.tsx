import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const MATEN = new Set(['192', '512'])
const bebasNeuePromise = readFile(join(process.cwd(), 'assets/fonts/BebasNeue-Regular.ttf'))

// Eigen icoon voor de admin-app: amberkleurige achtergrond met donkere letters, zodat het op het
// beginscherm niet te verwarren is met de gewone ArnoBot-app (donker met lichte letters).
// De letters blijven binnen de middelste ~55%: veilig voor het afgeronde masker van Android.
export async function GET(_req: Request, { params }: { params: Promise<{ maat: string }> }) {
  const { maat } = await params
  if (!MATEN.has(maat)) return new Response('Niet gevonden', { status: 404 })
  const px = Number(maat)
  const bebasNeue = await bebasNeuePromise

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f59e0b',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: px * 0.42, color: '#111827', lineHeight: 1 }}>AB</div>
        <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: px * 0.13, color: '#111827', letterSpacing: px * 0.03, lineHeight: 1, marginTop: px * 0.02 }}>ADMIN</div>
      </div>
    ),
    {
      width: px,
      height: px,
      fonts: [{ name: 'Bebas Neue', data: bebasNeue, style: 'normal', weight: 400 }],
      headers: { 'Cache-Control': 'public, max-age=86400' },
    },
  )
}
