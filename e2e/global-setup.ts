import { startMockAnthropicServer } from './mocks/mockAnthropicServer'
import { startMockVoyageServer } from './mocks/mockVoyageServer'

export const MOCK_ANTHROPIC_PORT = 4010
export const MOCK_VOYAGE_PORT = 4011

// Draait één keer vóór alle projecten/tests. De mock-servers blijven de rest van de
// testsessie draaien (geen .close() nodig, het Playwright-proces sluit ze vanzelf af bij
// afloop). Niveau-2-tests (page.route) raken deze servers nooit, want die onderscheppen de
// aanvraag al in de browser vóórdat de server hem ziet. Alleen niveau-3-tests (echte
// backend, geen page.route-mock) laten de server echt bij deze mock-servers uitkomen, via
// ANTHROPIC_BASE_URL/VOYAGE_BASE_URL in playwright.config.ts.
export default async function globalSetup() {
  await startMockAnthropicServer(MOCK_ANTHROPIC_PORT)
  await startMockVoyageServer(MOCK_VOYAGE_PORT)
}
