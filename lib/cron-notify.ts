export async function notifyCronFailure(cronName: string, err: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const message = err instanceof Error ? err.message : String(err)
  const text = `Cron mislukt op arno.bot\n\nCron: ${cronName}\nFout: ${message}`

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {})
}
