import { Router } from 'express'
import { calcHoldings } from '../services/portfolio.js'
import { getMultiplePrices } from '../services/stockPrice.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const holdings = calcHoldings(req.user.userId)
    const prices = await getMultiplePrices(holdings.map(h => h.code))

    const result = holdings.map(h => {
      const avg_cost = h.shares ? h.total_cost / h.shares : 0
      const current_price = prices[h.code] ?? null
      const current_value = current_price != null ? current_price * h.shares : null
      const pnl = current_value != null ? current_value - h.total_cost : null
      const pnl_percent = pnl != null && h.total_cost ? (pnl / h.total_cost) * 100 : null
      return { ...h, avg_cost, current_price, current_value, pnl, pnl_percent }
    })

    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
