import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import { type ClientConfig } from "pg";
import fs from "fs";

const USE_SSL = process.env.USE_SSL_FOR_POSTGRES === "true";

// Path to where we download the certificate bundle in user_data script
const rdsCaCertPath = "/opt/certs/rds-ca-bundle.pem";

const poolConfig = {
  connectionString: env.DATABASE_URL,
} as ClientConfig;

if (USE_SSL) {
  poolConfig.ssl = {
    // This is crucial for security
    rejectUnauthorized: true,
    ca: fs.readFileSync(rdsCaCertPath).toString(),
  };
} else if (env.DATABASE_URL?.includes("neon.tech") || process.env.VERCEL) {
  // Neon Postgres requires SSL
  poolConfig.ssl = true;
}

export const db = drizzle({
  connection: poolConfig,
});

export * from "./schemas";
