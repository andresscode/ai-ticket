import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`bff listening on http://localhost:${info.port}`)
})
