import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, '../../stock_genie.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    shares INTEGER NOT NULL,
    price REAL NOT NULL,
    fee REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS dividends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    dividend_per_share REAL NOT NULL,
    shares INTEGER NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`)

export default db
