import { Router } from 'express'
import db from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM dividends WHERE user_id = $1 ORDER BY date DESC',
    [req.user.userId]
  )
  res.json(rows)
})

router.post('/', authMiddleware, async (req, res) => {
  const { date, code, name, dividend_per_share, shares, amount } = req.body
  if (!date || !code || !name || !dividend_per_share || !shares || !amount) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const { rows } = await db.query(
    'INSERT INTO dividends (user_id, date, code, name, dividend_per_share, shares, amount) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [req.user.userId, date, code.toUpperCase(), name, dividend_per_share, shares, amount]
  )
  res.status(201).json({ id: rows[0].id })
})

router.delete('/:id', authMiddleware, async (req, res) => {
  await db.query('DELETE FROM dividends WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId])
  res.json({ ok: true })
})

export default router
