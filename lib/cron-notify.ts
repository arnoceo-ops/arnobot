// Telegram staat niet bij de sub-verwerkers: er gaan geen namen, e-mailadressen of gespreksteksten heen. Namen en
// tekst blijven bij de bron weg; deze functie is het vangnet voor e-mailadressen, IP-adressen en profiellinks die
// via een foutmelding of een nieuwe melding meeliften. Eigen adressen van arno.bot blijven staan.
// Alle verzendingen lopen via notifyTelegram (afgedwongen in lib/cron-notify.test.ts).
export function schoonVoorTelegram(tekst: string): string {
  return tekst
    .replace(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/\S+/gi, '[profiellink]')
    .replace(/[A-Za-z0-9._%+-]+@(?!arno\.bot\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mailadres]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    .replace(/(?<![\w:])(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?)(?![\w:])/gi, '[ip]')
}

/** Geeft false als het bericht niet is aangekomen. Zonder token (lokaal, test) is er niets te versturen. */
export async function notifyTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return true

  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: schoonVoorTelegram(text) }),
    // Een hangende melding mag nooit een betaalverwerking of cron ophouden.
    signal: AbortSignal.timeout(8000),
  }).then(r => r.ok).catch(() => false)
}

export async function notifyCronFailure(cronName: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  await notifyTelegram(`Cron mislukt op arno.bot\n\nCron: ${cronName}\nFout: ${message}`)
}
