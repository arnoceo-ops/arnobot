/** Geeft false als het bericht niet is aangekomen. Zonder token (lokaal, test) is er niets te versturen. */
export async function notifyTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return true

  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    // Een hangende melding mag nooit een betaalverwerking of cron ophouden.
    signal: AbortSignal.timeout(8000),
  }).then(r => r.ok).catch(() => false)
}

export async function notifyCronFailure(cronName: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  await notifyTelegram(`Cron mislukt op arno.bot\n\nCron: ${cronName}\nFout: ${message}`)
}
