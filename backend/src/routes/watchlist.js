import { Router } from 'express'
import db from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { getMultiplePrices, getStockInfo } from '../services/stockPrice.js'
import { calcHoldings } from '../services/portfolio.js'

const router = Router()

async function ensureDefaultList(userId) {
  await db.query(
    "INSERT INTO watchlists (user_id, name, sort_order) VALUES ($1, '我的最愛', 0) ON CONFLICT (user_id, name) DO NOTHING",
    [userId]
  )
}

// 取得所有清單（含股票數）
router.get('/', authMiddleware, async (req, res) => {
  await ensureDefaultList(req.user.userId)
  const { rows } = await db.query(
    `SELECT w.id, w.name, w.sort_order, COUNT(ws.id)::int AS stock_count
     FROM watchlists w
     LEFT JOIN watchlist_stocks ws ON ws.watchlist_id = w.id
     WHERE w.user_id = $1
     GROUP BY w.id
     ORDER BY w.sort_order, w.created_at`,
    [req.user.userId]
  )
  res.json(rows)
})

// 建立清單
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '缺少清單名稱' })
  try {
    const { rows } = await db.query(
      'INSERT INTO watchlists (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.userId, name.trim()]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: '清單名稱已存在' })
    res.status(500).json({ error: e.message })
  }
})

// 刪除清單
router.delete('/:id', authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    'SELECT name FROM watchlists WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.userId]
  )
  if (!rows.length) return res.status(404).json({ error: '清單不存在' })
  if (rows[0].name === '我的最愛') return res.status(400).json({ error: '不能刪除我的最愛' })
  await db.query('DELETE FROM watchlists WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// 取得我的持股（動態）
router.get('/holdings', authMiddleware, async (req, res) => {
  const holdings = await calcHoldings(req.user.userId)
  const prices = await getMultiplePrices(holdings.map(h => h.code))
  res.json(holdings.map(h => {
    const price = prices[h.code] ?? null
    const pnl = price != null ? price * h.shares - h.total_cost : null
    const pnlPercent = pnl != null && h.total_cost ? (pnl / h.total_cost) * 100 : null
    return { ...h, price, pnl, pnlPercent }
  }))
})

// 取得清單股票（含現價）
router.get('/:id/stocks', authMiddleware, async (req, res) => {
  const { rows: wl } = await db.query(
    'SELECT id FROM watchlists WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.userId]
  )
  if (!wl.length) return res.status(404).json({ error: '清單不存在' })
  const { rows } = await db.query(
    'SELECT * FROM watchlist_stocks WHERE watchlist_id = $1 ORDER BY sort_order, created_at',
    [req.params.id]
  )
  const prices = await getMultiplePrices(rows.map(r => r.code))
  res.json(rows.map(r => ({ ...r, price: prices[r.code] ?? null })))
})

// 新增股票到清單
router.post('/:id/stocks', authMiddleware, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: '缺少股票代號' })
  const { rows: wl } = await db.query(
    'SELECT id FROM watchlists WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.userId]
  )
  if (!wl.length) return res.status(404).json({ error: '清單不存在' })
  const info = await getStockInfo(code)
  const { rows } = await db.query(
    'INSERT INTO watchlist_stocks (watchlist_id, code, name) VALUES ($1, $2, $3) ON CONFLICT (watchlist_id, code) DO NOTHING RETURNING *',
    [req.params.id, code.toUpperCase(), info.name || code.toUpperCase()]
  )
  res.status(201).json(rows[0] ?? { ok: true, message: '已在清單中' })
})

// 刪除清單中的股票
router.delete('/:id/stocks/:code', authMiddleware, async (req, res) => {
  await db.query(
    'DELETE FROM watchlist_stocks WHERE watchlist_id = $1 AND code = $2',
    [req.params.id, req.params.code.toUpperCase()]
  )
  res.json({ ok: true })
})

export default router
