import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { tenantStorage } from './tenant-context'
import { registerCheckAvailability } from './tools/check-availability'
import { registerGetEvent } from './tools/get-event'
import { registerListEvents } from './tools/list-events'
import { registerSuggestSeats } from './tools/suggest-seats'

const PORT = 3002

function createMcpServer() {
  const server = new McpServer({ name: 'mcp-events', version: '1.0.0' })
  registerListEvents(server)
  registerGetEvent(server)
  registerCheckAvailability(server)
  registerSuggestSeats(server)
  return server
}

const httpServer = createServer(async (req, res) => {
  if (req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const tenantId = req.headers['x-tenant-id']
  if (!tenantId || typeof tenantId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'X-Tenant-ID header is required' }))
    return
  }

  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  await server.connect(transport)
  await tenantStorage.run({ tenantId }, () => transport.handleRequest(req, res))
})

httpServer.listen(PORT, () => {
  console.log(`mcp-events listening on http://localhost:${PORT}`)
})
