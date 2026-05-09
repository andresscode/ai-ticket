import 'dotenv/config'
import { createDb, type Database } from '@ai-ticket/db'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

export const db: Database = createDb(process.env.DATABASE_URL)
