import { createDatabase, type Database } from '@atlasmed/database'
import { environment } from '../../app/config/environment'

export const db: Database = createDatabase(environment.DATABASE_URL)
