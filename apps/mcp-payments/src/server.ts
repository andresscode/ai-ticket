import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { tenantStorage } from './tenant-context'
import { registerCompletePayment } from './tools/complete-payment'
import { registerInitPayment } from './tools/init-payment'

const PORT = 3004

function createMcpServer() {
  const server = new McpServer({ name: 'mcp-payments', version: '1.0.0' })
  registerInitPayment(server)
  registerCompletePayment(server)
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

  const userId = req.headers['x-user-id']
  if (!userId || typeof userId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'X-User-ID header is required' }))
    return
  }

  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  await server.connect(transport)
  await tenantStorage.run({ tenantId, userId }, () =>
    transport.handleRequest(req, res),
  )
})

httpServer.listen(PORT, () => {
  console.log(`mcp-payments listening on http://localhost:${PORT}`)
})
