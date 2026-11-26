/**
 * Bestaat de tabel nog niet (de SQL is niet uitgevoerd)? Bewust smal: een tijdelijke fout van de databaselaag, ook een
 * met "schema cache" in de tekst, telt niet.
 */
export const tabelOntbreekt = (fout: { message: string }) => /relation .+ does not exist|Could not find the table/i.test(fout.message)
