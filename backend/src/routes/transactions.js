import { Router } from 'express'
import db from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
    [req.user.userId]
  )
  res.json(rows.map(r => ({
    ...r,
    shares: Number(r.shares),
    price: Number(r.price),
    fee: Number(r.fee),
  })))
})

router.post('/', authMiddleware, async (req, res) => {
  const { date, code, name, category = '', type, shares, price, fee = 0 } = req.body
  if (!date || !code || !name || !type || !shares || !price) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const { rows } = await db.query(
    'INSERT INTO transactions (user_id, date, code, name, category, type, shares, price, fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
    [req.user.userId, date, code.toUpperCase(), name, category, type, shares, price, fee]
  )
  res.status(201).json({ id: rows[0].id })
})

router.delete('/:id', authMiddleware, async (req, res) => {
  await db.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId])
  res.json({ ok: true })
})

export default router
