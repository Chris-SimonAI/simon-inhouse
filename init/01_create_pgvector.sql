CREATE EXTENSION IF NOT EXISTS vector;

-- Also load it into template1 so future DBs inherit it
\connect template1
CREATE EXTENSION IF NOT EXISTS vector;
