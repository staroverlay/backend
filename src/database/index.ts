import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";
import { logger } from "@/logger";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
    logger.error("Unexpected error on idle client: " + err);
});

pool.on("connect", () => {
    logger.info("Database connected successfully");
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;