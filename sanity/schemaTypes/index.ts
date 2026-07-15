import { type SchemaTypeDefinition } from 'sanity'
import sparPage from './sparPage'
import testimonial from './testimonial'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [sparPage, testimonial],
}
