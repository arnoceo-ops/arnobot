import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const bebasNeuePromise = readFile(join(process.cwd(), 'assets/fonts/BebasNeue-Regular.ttf'))

export default async function AppleIcon() {
  const bebasNeue = await bebasNeuePromise

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 110, letterSpacing: 0 }}>
          <span style={{ color: '#f1f5f9' }}>A</span>
          <span style={{ color: '#f59e0b' }}>B</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Bebas Neue', data: bebasNeue, style: 'normal', weight: 400 }],
    }
  )
}
