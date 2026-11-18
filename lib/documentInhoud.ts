// Omzetten van een geüploade bijlage naar wat het model kan lezen. Verplaatst uit app/api/chat/route.ts
// zonder inhoudelijke wijziging, zodat zowel de oude route als lib/documenten.ts hem delen.
import type Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

export const NATIVE_DOCUMENT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
export const TEXT_EXTRACT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

export type UploadedDocument = { name: string; mediaType: string; data: string }

export async function buildDocumentContentBlock(
  doc: UploadedDocument
): Promise<{ block: Anthropic.Messages.ContentBlockParam | null; extractedText: string | null; error: string | null }> {
  if (!NATIVE_DOCUMENT_TYPES.has(doc.mediaType) && !TEXT_EXTRACT_TYPES.has(doc.mediaType)) {
    return { block: null, extractedText: null, error: 'bestandstype_niet_ondersteund' }
  }

  // Grootte wordt al gecontroleerd door de aanroeper op het gedownloade buffer (vóór
  // base64-encoderen), dat is nu de enige plek waar de ruwe bestandsgrootte nog bekend is.

  if (doc.mediaType === 'application/pdf') {
    return {
      block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } },
      extractedText: null,
      error: null,
    }
  }

  if (doc.mediaType.startsWith('image/')) {
    return {
      block: { type: 'image', source: { type: 'base64', media_type: doc.mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: doc.data } },
      extractedText: null,
      error: null,
    }
  }

  // .docx / .txt / .csv worden niet native ondersteund door de Messages API document-blocks,
  // dus zelf omzetten naar platte tekst en meesturen als onderdeel van het tekstbericht.
  const buffer = Buffer.from(doc.data, 'base64')
  try {
    if (doc.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.extractRawText({ buffer })
      return { block: null, extractedText: value, error: null }
    }
    return { block: null, extractedText: buffer.toString('utf-8'), error: null }
  } catch {
    return { block: null, extractedText: null, error: 'bestand_niet_leesbaar' }
  }
}
