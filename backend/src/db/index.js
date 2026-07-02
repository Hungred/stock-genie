import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      line_user_id TEXT UNIQUE NOT NULL,
      display_name TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      date TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
      shares INTEGER NOT NULL,
      price NUMERIC NOT NULL,
      fee NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dividends (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      date TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      dividend_per_share NUMERIC NOT NULL,
      shares INTEGER NOT NULL,
      amount NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS watchlist_stocks (
      id SERIAL PRIMARY KEY,
      watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(watchlist_id, code)
    );

    CREATE TABLE IF NOT EXISTS dividend_schedules (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT DEFAULT '',
      ex_date DATE NOT NULL,
      dividend_cash NUMERIC DEFAULT 0,
      dividend_stock NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(code, ex_date)
    );

    CREATE TABLE IF NOT EXISTS dividend_notify_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      enabled BOOLEAN DEFAULT true,
      remind_days_before INTEGER DEFAULT NULL,
      UNIQUE(user_id, scope)
    );

    ALTER TABLE dividends ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

    CREATE TABLE IF NOT EXISTS stocks (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      exchange TEXT DEFAULT 'TWSE',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks(name);
  `)
}

export default pool
