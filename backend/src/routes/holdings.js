import { Router } from 'express'
import db from '../db/index.js'
import { getMultiplePrices } from '../services/stockPrice.js'

const router = Router()

// 從交易記錄計算各股持倉與加權平均成本
function calcHoldings() {
  const rows = db.prepare(`SELECT * FROM transactions ORDER BY date ASC`).all()

  const map = {}
  for (const t of rows) {
    const key = t.code
    if (!map[key]) {
      map[key] = { code: t.code, name: t.name, category: t.category, shares: 0, total_cost: 0 }
    }
    if (t.type === 'buy') {
      map[key].total_cost += t.shares * t.price + (t.fee || 0)
      map[key].shares += t.shares
    } else {
      // 賣出：依比例減少成本
      const ratio = t.shares / map[key].shares
      map[key].total_cost -= map[key].total_cost * ratio
      map[key].shares -= t.shares
    }
  }

  return Object.values(map).filter(h => h.shares > 0)
}

router.get('/', async (req, res) => {
  try {
    const holdings = calcHoldings()
    const codes = holdings.map(h => h.code)
    const prices = await getMultiplePrices(codes)

    const result = holdings.map(h => {
      const avg_cost = h.shares ? h.total_cost / h.shares : 0
      const current_price = prices[h.code] ?? null
      const current_value = current_price ? current_price * h.shares : null
      const pnl = current_value !== null ? current_value - h.total_cost : null
      const pnl_percent = pnl !== null && h.total_cost ? (pnl / h.total_cost) * 100 : null
      return { ...h, avg_cost, current_price, current_value, pnl, pnl_percent }
    })

    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
