import { Router } from 'express'
import db from '../db/index.js'
import { getMultiplePrices } from '../services/stockPrice.js'
import { generatePieChart, generateBarChart } from '../services/chartGen.js'

const router = Router()

function calcHoldings() {
  const rows = db.prepare(`SELECT * FROM transactions ORDER BY date ASC`).all()
  const map = {}
  for (const t of rows) {
    if (!map[t.code]) map[t.code] = { code: t.code, name: t.name, shares: 0, total_cost: 0 }
    if (t.type === 'buy') {
      map[t.code].total_cost += t.shares * t.price + (t.fee || 0)
      map[t.code].shares += t.shares
    } else {
      const ratio = t.shares / map[t.code].shares
      map[t.code].total_cost -= map[t.code].total_cost * ratio
      map[t.code].shares -= t.shares
    }
  }
  return Object.values(map).filter(h => h.shares > 0)
}

async function getHoldingsWithPrice() {
  const holdings = calcHoldings()
  const prices = await getMultiplePrices(holdings.map(h => h.code))
  return holdings.map(h => {
    const current_price = prices[h.code] ?? null
    const current_value = current_price ? current_price * h.shares : null
    const pnl = current_value !== null ? current_value - h.total_cost : null
    return { ...h, current_price, current_value, pnl }
  })
}

router.get('/pie', async (req, res) => {
  try {
    const holdings = await getHoldingsWithPrice()
    const png = await generatePieChart(holdings)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'no-cache')
    res.send(png)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/bar', async (req, res) => {
  try {
    const holdings = await getHoldingsWithPrice()
    const png = await generateBarChart(holdings)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'no-cache')
    res.send(png)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
