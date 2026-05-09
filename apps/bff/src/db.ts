import { createDb, type Database } from '@ai-ticket/db'
import { env } from './env'

export const db: Database = createDb(env.databaseUrl)
