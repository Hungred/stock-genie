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
