import { renderToBuffer } from '@react-pdf/renderer'
import { BeveiligingsPdfDocument } from '@/components/BeveiligingsPdfDocument'
import React from 'react'

export async function GET() {
  const buffer = await renderToBuffer(React.createElement(BeveiligingsPdfDocument))
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="arnobot-beveiliging.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
