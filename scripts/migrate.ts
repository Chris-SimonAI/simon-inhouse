#!/usr/bin/env node

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { type ClientConfig, Pool } from "pg";
import "dotenv/config";
import fs from "fs";

async function runMigrations() {
  console.log("🗄️ Running database migrations...");

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const USE_SSL = process.env.USE_SSL_FOR_POSTGRES === "true";

  const poolConfig = {
    connectionString: DATABASE_URL,
  } as ClientConfig;

  if (USE_SSL) {
    // Path to where we download the certificate bundle in user_data script
    const rdsCaCertPath = "/opt/certs/rds-ca-bundle.pem";

    if (!fs.existsSync(rdsCaCertPath)) {
      throw new Error(`SSL is enabled but certificate file not found at: ${rdsCaCertPath}`);
    }

    console.log(`📜 Using SSL certificate from: ${rdsCaCertPath}`);

    poolConfig.ssl = {
      rejectUnauthorized: true, // This is crucial for security
      // Read the certificate authority bundle from the file system
      ca: fs.readFileSync(rdsCaCertPath).toString(),
    };
  }

  const pool = new Pool(poolConfig);

  try {
    // ✅ Step 1: Check if pgvector is installed
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("✅ pgvector extension installed successfully.");
    

    // ✅ Step 2: Run migrations
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
    console.log("🔌 Database connection closed.");
  }
}

async function main() {
  try {
    await runMigrations();
    console.log("✅ Migration script completed successfully");
  } catch (error) {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  }
}

main();
