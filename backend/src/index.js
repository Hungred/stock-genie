import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import transactionsRouter from './routes/transactions.js'
import holdingsRouter from './routes/holdings.js'
import dividendsRouter from './routes/dividends.js'
import linebotRouter from './routes/linebot.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use('/api/linebot/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ status: 'ok', name: '股小秘 Stock Genie' }))

app.use('/api/transactions', transactionsRouter)
app.use('/api/holdings', holdingsRouter)
app.use('/api/dividends', dividendsRouter)
app.use('/api/linebot', linebotRouter)

app.listen(PORT, () => {
  console.log(`🚀 股小秘後端啟動 port ${PORT}`)
})
