import { Router } from 'express'
import { calcHoldings } from '../services/portfolio.js'
import { getMultiplePrices, getIntradayCandles, getFullQuote } from '../services/stockPrice.js'
import { generatePieChart, generateBarChart, generateKlineChart } from '../services/chartGen.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

async function getHoldingsWithPrice(userId) {
  const holdings = await calcHoldings(userId)
  const prices = await getMultiplePrices(holdings.map(h => h.code))
  return holdings.map(h => {
    const current_price = prices[h.code] ?? null
    const current_value = current_price != null ? current_price * h.shares : null
    const pnl = current_value != null ? current_value - h.total_cost : null
    return { ...h, current_price, current_value, pnl }
  })
}

router.get('/pie', authMiddleware, async (req, res) => {
  try {
    const holdings = await getHoldingsWithPrice(req.user.userId)
    const png = await generatePieChart(holdings)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'no-cache')
    res.send(png)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/bar', authMiddleware, async (req, res) => {
  try {
    const holdings = await getHoldingsWithPrice(req.user.userId)
    const png = await generateBarChart(holdings)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'no-cache')
    res.send(png)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// K線走勢圖（不需要認證，股價為公開資料）
router.get('/kline', async (req, res) => {
  const code = req.query.code?.toUpperCase()
  if (!code) return res.status(400).json({ error: 'code required' })
  try {
    const [candles, quote] = await Promise.all([
      getIntradayCandles(code),
      getFullQuote(code),
    ])
    const png = await generateKlineChart(candles, quote?.prevClose)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'no-cache')
    res.send(png)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
