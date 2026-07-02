import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDb } from './db/index.js'
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

// 股票搜尋：支援代號或中文名稱
app.get('/api/stock/search', async (req, res) => {
  const q = req.query.q?.trim()
  if (!q) return res.status(400).json({ error: 'q required' })
  const { getStockInfo } = await import('./services/stockPrice.js')
  const { default: axios } = await import('axios')

  // 先試代號
  const info = await getStockInfo(q)
  if (info.name) return res.json({ code: q.toUpperCase(), name: info.name })

  // 用 Yahoo Finance 搜尋（支援中文名稱）
  try {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=zh-TW&region=TW&quotesCount=5&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }
    )
    const hit = (data?.quotes ?? []).find(q => q.exchange === 'TAI' || q.exchange === 'TWO')
    if (hit) {
      const code = hit.symbol.replace(/\.(TW|TWO)$/, '')
      return res.json({ code, name: hit.shortname || hit.longname || code })
    }
  } catch {}

  res.status(404).json({ error: '找不到此股票' })
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
