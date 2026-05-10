import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { authRoutes } from './routes/auth'
import { chatRoutes } from './routes/chat'
import { hitlRoutes } from './routes/hitl'
import { ordersRoutes } from './routes/orders'
import { sessions } from './session'

const app = new Hono()

app.use('*', sessions)
app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/', authRoutes)
app.route('/', chatRoutes)
app.route('/', hitlRoutes)
app.route('/', ordersRoutes)

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`bff listening on http://localhost:${info.port}`)
})
