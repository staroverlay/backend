import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;