// Maakt het icoon van de admin-telefoonpagina (public/admin-icoon-192.png en -512.png).
// Eenmalig draaien en de PNG's committen: de site rendert niets op aanvraag. Het lettertype Arial Black
// moet op de machine staan (Windows heeft het), anders valt sharp terug op een ander lettertype en is het
// resultaat anders: kijk dan altijd naar de uitkomst. Ontwerp: amberkleurig vlak, dikke donkere letters
// zoals het icoon van de gewone app, ADMIN eronder. Alles binnen de veilige cirkel van Android (80%).
import sharp from 'sharp'

const FONT = 'Arial Black, Arial, Helvetica, sans-serif'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#f59e0b"/>
  <text x="256" y="292" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="215" fill="#111827" letter-spacing="-8">AB</text>
  <text x="256" y="372" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="58" fill="#111827" letter-spacing="14">ADMIN</text></svg>`

for (const maat of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(maat).png().toFile(`public/admin-icoon-${maat}.png`)
  console.log(`public/admin-icoon-${maat}.png`)
}
