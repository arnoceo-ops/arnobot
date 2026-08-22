import { Font } from '@react-pdf/renderer'

// Merklettertypen voor react-pdf-documenten (team-rapport, 1:1-agenda). react-pdf kan geen
// CSS @font-face/Google Fonts gebruiken zoals de rest van de app, het heeft echte
// TTF-bestanden nodig via Font.register(). Bestanden staan lokaal in public/fonts/ (geen
// afhankelijkheid van fonts.gstatic.com op het moment van genereren, dat gebeurt hier
// client-side in de browser van de gebruiker). Bebas Neue heeft in de rest van de app ook maar
// één gewicht (regular), dus geen bold-variant nodig; Space Mono-labels zijn in de webversie
// bewust font-weight 400 (.coaching-label), niet bold, zelfde hier.
let registered = false

export function registerBrandFonts() {
  if (registered) return
  registered = true
  Font.register({ family: 'Bebas Neue', src: '/fonts/BebasNeue-Regular.ttf' })
  Font.register({ family: 'Space Mono', src: '/fonts/SpaceMono-Regular.ttf' })
}
