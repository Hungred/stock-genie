import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDb } from './db/index.js'
import pool from './db/index.js'
import transactionsRouter from './routes/transactions.js'
import holdingsRouter from './routes/holdings.js'
import dividendsRouter from './routes/dividends.js'
import linebotRouter from './routes/linebot.js'
import chartsRouter from './routes/charts.js'
import authRouter from './routes/auth.js'
import watchlistRouter from './routes/watchlist.js'

await initDb()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use('/api/linebot/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ status: 'ok', name: '股小秘 Stock Genie' }))

// 股票搜尋：回傳多筆讓使用者選
app.get('/api/stock/search', async (req, res) => {
  const q = req.query.q?.trim()
  if (!q) return res.status(400).json({ error: 'q required' })

  // 先從本地 stocks 表查詢（名稱或代號模糊比對）
  const { rows } = await pool.query(
    `SELECT code, name FROM stocks
     WHERE name ILIKE $1 OR code ILIKE $1
     ORDER BY
       CASE WHEN code ILIKE $2 THEN 0
            WHEN name ILIKE $2 THEN 1
            ELSE 2 END,
       code
     LIMIT 10`,
    [`%${q}%`, `${q}%`]
  )
  if (rows.length) return res.json(rows)

  // 本地無資料時 fallback：用 Fugle 查單一代號
  const { getStockInfo } = await import('./services/stockPrice.js')
  const info = await getStockInfo(q)
  if (info.name) return res.json([{ code: q.toUpperCase(), name: info.name }])

  res.status(404).json({ error: '找不到相關股票，請改用股票代號（如 0050）或等候股票清單更新' })
})

// 股票清單 seed（GitHub Actions 每週呼叫）
app.post('/api/stocks/seed', async (req, res) => {
  const secret = req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  const stocks = req.body
  if (!Array.isArray(stocks) || !stocks.length) return res.status(400).json({ error: 'array required' })

  let count = 0
  for (const { code, name, exchange } of stocks) {
    if (!code || !name) continue
    await pool.query(
      `INSERT INTO stocks(code, name, exchange, updated_at)
       VALUES($1, $2, $3, NOW())
       ON CONFLICT(code) DO UPDATE SET name=$2, exchange=$3, updated_at=NOW()`,
      [code, name, exchange ?? 'TWSE']
    )
    count++
  }
  res.json({ ok: true, count })
})

app.get('/api/stock/:code', async (req, res) => {
  const { getStockInfo } = await import('./services/stockPrice.js')
  const info = await getStockInfo(req.params.code)
  if (!info.name) return res.status(404).json({ error: '找不到此股票代號' })
  res.json(info)
})

app.use('/api/auth', authRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/holdings', holdingsRouter)
app.use('/api/dividends', dividendsRouter)
app.use('/api/linebot', linebotRouter)
app.use('/api/charts', chartsRouter)
app.use('/api/watchlist', watchlistRouter)

app.listen(PORT, () => {
  console.log(`🚀 股小秘後端啟動 port ${PORT}`)
})
