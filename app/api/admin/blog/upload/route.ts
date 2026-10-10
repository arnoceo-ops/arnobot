import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdminSession } from '@/lib/adminAuth'
import { BLOG_IMAGE_BUCKET, getBlogDb } from '@/lib/blog'

const MAX_BYTES = 5 * 1024 * 1024

// Type bepalen aan de hand van de eerste bytes, niet aan de bestandsnaam of het door de
// client opgegeven type. SVG staat bewust niet in de lijst: kan script bevatten.
function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  if (buf.length > 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) {
    return { ext: 'gif', mime: 'image/gif' }
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Afbeelding is groter dan 5 MB' }, { status: 413 })

  const buf = Buffer.from(await file.arrayBuffer())
  const kind = sniffImage(buf)
  if (!kind) return NextResponse.json({ error: 'Alleen PNG, JPG, WebP of GIF' }, { status: 415 })

  const path = `${new Date().getUTCFullYear()}/${randomUUID()}.${kind.ext}`
  const db = getBlogDb()
  const { error } = await db.storage.from(BLOG_IMAGE_BUCKET).upload(path, buf, {
    contentType: kind.mime,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return NextResponse.json({ error: 'Uploaden mislukt' }, { status: 500 })

  const { data } = db.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
