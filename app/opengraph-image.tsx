import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Site-brede default social card. Elke publieke pagina zonder eigen opengraph-image
// erft deze via de Next.js file-convention (dieper genest bestand wint, geen van de
// pagina's heeft er zelf een, dus dit is de kaart die overal getoond wordt bij het
// delen van een arno.bot-link).
export const alt = 'ArnoBot: Jouw AI Sales Coach'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const bebasNeuePromise = readFile(join(process.cwd(), 'public/fonts/BebasNeue-Regular.ttf'))
const spaceMonoPromise = readFile(join(process.cwd(), 'public/fonts/SpaceMono-Regular.ttf'))

export default async function Image() {
  const [bebasNeue, spaceMono] = await Promise.all([bebasNeuePromise, spaceMonoPromise])

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
          background: '#111827',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Bebas Neue',
            fontSize: 140,
            letterSpacing: 4,
          }}
        >
          <span style={{ color: '#f1f5f9' }}>ARNO</span>
          <span style={{ color: '#f59e0b' }}>BOT</span>
        </div>
        <div
          style={{
            width: 220,
            height: 2,
            background: '#f59e0b',
            marginTop: 28,
            marginBottom: 28,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontFamily: 'Space Mono',
            fontSize: 28,
            letterSpacing: 3,
            color: '#9ca3af',
          }}
        >
          JOUW AI SALES COACH
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bebas Neue', data: bebasNeue, style: 'normal', weight: 400 },
        { name: 'Space Mono', data: spaceMono, style: 'normal', weight: 400 },
      ],
    }
  )
}
