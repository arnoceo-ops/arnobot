import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublishedPostBySlug } from '@/lib/blog'
import { isValidSlug } from '@/lib/blogText'

// Deelkaart per blogpost: de afbeelding die LinkedIn, Slack en WhatsApp tonen als een link naar het
// artikel wordt gedeeld. Merkkaart met de titel groot, de hashtags en het webadres. Bewust zonder
// omslagfoto: geen externe afbeelding ophalen tijdens het tekenen, dus geen kans dat de kaart
// stukgaat als een foto ontbreekt of een vreemd formaat heeft. 1200 x 630 is de maat die
// LinkedIn en andere platforms verwachten. Zelfde lettertypen en bundeling als app/opengraph-image.tsx.
export const alt = 'ArnoBot Blog'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const bebasNeuePromise = readFile(join(process.cwd(), 'assets/fonts/BebasNeue-Regular.ttf'))
const spaceMonoPromise = readFile(join(process.cwd(), 'assets/fonts/SpaceMono-Regular.ttf'))

// Lange titels krijgen een kleiner lettertype zodat ze op de kaart passen.
function titelGrootte(titel: string): number {
  if (titel.length <= 36) return 120
  if (titel.length <= 60) return 96
  if (titel.length <= 90) return 78
  return 64
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [bebasNeue, spaceMono] = await Promise.all([bebasNeuePromise, spaceMonoPromise])
  const post = isValidSlug(slug) ? await getPublishedPostBySlug(slug) : null

  const titel = (post?.title ?? 'Best Practices').slice(0, 120)
  const tags = (post?.tags ?? []).slice(0, 4).map(t => `#${t}`).join('  ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#111827',
          padding: '64px 72px',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 64, letterSpacing: 6 }}>
          <span style={{ color: '#f1f5f9' }}>ARNO</span>
          <span style={{ color: '#f59e0b' }}>BOT</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 160, height: 4, background: '#f59e0b', marginBottom: 32 }} />
          <div
            style={{
              display: 'flex',
              fontFamily: 'Bebas Neue',
              fontSize: titelGrootte(titel),
              lineHeight: 1.05,
              letterSpacing: 2,
              color: '#f1f5f9',
            }}
          >
            {titel}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Space Mono', fontSize: 28 }}>
          <div style={{ display: 'flex', color: '#f59e0b', letterSpacing: 2 }}>{tags}</div>
          <div style={{ display: 'flex', color: '#9ca3af', letterSpacing: 3 }}>ARNO.BOT/BLOG</div>
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
