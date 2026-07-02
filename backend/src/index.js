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
  const FUGLE_KEY = process.env.FUGLE_API_KEY

  // 先試代號（Fugle quote）
  const info = await getStockInfo(q)
  if (info.name) return res.json({ code: q.toUpperCase(), name: info.name })

  // 再試 Fugle tickers 名稱搜尋（TWSE + TPEx）
  if (FUGLE_KEY) {
    for (const exchange of ['TWSE', 'TPEx']) {
      try {
        const { data } = await axios.get(
          `https://api.fugle.tw/marketdata/v1.0/stock/intraday/tickers?type=EQUITY&exchange=${exchange}&query=${encodeURIComponent(q)}`,
          { headers: { 'X-API-KEY': FUGLE_KEY }, timeout: 5000 }
        )
        const items = data?.data ?? []
        if (items.length) {
          return res.json({ code: items[0].symbol, name: items[0].name })
        }
      } catch {}
    }
  }

  res.status(404).json({ error: '找不到此股票，請改用股票代號（如 0050）' })
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
