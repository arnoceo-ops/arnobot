// Zet het woord "ArnoBot" in de merkkleuren: ARNO in de tekstkleur, BOT in amber, zoals het
// logo in de navigatie en de mails. Alle andere tekst blijft ongewijzigd.
export default function BrandText({ children }: { children: string }) {
  return (
    <>
      {children.split(/(ArnoBot)/g).map((part, i) =>
        part === 'ArnoBot' ? (
          <span key={i}>Arno<span className="bl-bot">Bot</span></span>
        ) : (
          part
        )
      )}
    </>
  )
}
