// Set required env BEFORE any module reads it via env.ts.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
process.env.ORCHESTRATOR_URL ??= 'http://orchestrator.test'
process.env.SESSION_SECRET ??=
  '0000000000000000000000000000000000000000000000000000000000000000'
