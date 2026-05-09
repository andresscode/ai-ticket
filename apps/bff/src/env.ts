import 'dotenv/config'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

export const env = {
  orchestratorUrl: required('ORCHESTRATOR_URL'),
  sessionSecret: required('SESSION_SECRET'),
  databaseUrl: required('DATABASE_URL'),
}
