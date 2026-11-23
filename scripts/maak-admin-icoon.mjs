// Maakt het icoon van de admin-telefoonpagina (public/admin-icoon-v2-192.png en -512.png) uit het
// originele ArnoBot-logo (public/arnobot-app-icon-source.png), zodat de lettervormen exact gelijk zijn:
// achtergrond amber, de A wit, de B donker (in het gewone logo is de achtergrond donker en de B amber).
// Eenmalig draaien en de PNG's committen: de site rendert niets op aanvraag.
// Het bronlogo heeft precies drie kleuren. Elke pixel (ook de gladde randen) wordt als mengsel van die
// drie uitgedrukt en met dezelfde verhouding in de nieuwe kleuren teruggezet, zodat de randen vloeiend blijven.
import sharp from 'sharp'

const BRON = [[31, 41, 55], [241, 245, 249], [245, 158, 11]] // achtergrond, A, B
const DOEL = [[245, 158, 11], [241, 245, 249], [17, 24, 39]] // amber, wit, donker

// Pixel = w0*P0 + w1*P1 + w2*P2 met w0+w1+w2 = 1, dus pixel - P2 = w0*(P0-P2) + w1*(P1-P2): twee onbekenden, kleinste kwadraten.
const [P0, P1, P2] = BRON
const kolom = (k) => [P0[k] - P2[k], P1[k] - P2[k]]
// Twee onbekenden (w0, w1) uit drie vergelijkingen: normaalvergelijkingen
const M = [[0, 0], [0, 0]]
for (let k = 0; k < 3; k++) { const [u, v] = kolom(k); M[0][0] += u * u; M[0][1] += u * v; M[1][1] += v * v }
M[1][0] = M[0][1]
const det2 = M[0][0] * M[1][1] - M[0][1] * M[1][0]

const { data, info } = await sharp('public/arnobot-app-icon-source.png').removeAlpha().raw().toBuffer({ resolveWithObject: true })
const uit = Buffer.alloc(data.length)
for (let i = 0; i < data.length; i += 3) {
  let r0 = 0, r1 = 0
  for (let k = 0; k < 3; k++) {
    const [u, v] = kolom(k)
    const d = data[i + k] - P2[k]
    r0 += u * d; r1 += v * d
  }
  let w0 = (M[1][1] * r0 - M[0][1] * r1) / det2
  let w1 = (-M[1][0] * r0 + M[0][0] * r1) / det2
  w0 = Math.min(1, Math.max(0, w0)); w1 = Math.min(1, Math.max(0, w1))
  if (w0 + w1 > 1) { const s = w0 + w1; w0 /= s; w1 /= s }
  const w2 = 1 - w0 - w1
  for (let k = 0; k < 3; k++) uit[i + k] = Math.round(w0 * DOEL[0][k] + w1 * DOEL[1][k] + w2 * DOEL[2][k])
}

for (const maat of [192, 512]) {
  await sharp(uit, { raw: { width: info.width, height: info.height, channels: 3 } })
    .resize(maat, maat, { kernel: 'lanczos3' }).png().toFile(`public/admin-icoon-v2-${maat}.png`)
  console.log(`public/admin-icoon-v2-${maat}.png`)
}
