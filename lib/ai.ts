import type { Message } from '@anthropic-ai/sdk/resources'

export function getText(content: Message['content'], fallback = ''): string {
  const block = content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text : fallback
}
