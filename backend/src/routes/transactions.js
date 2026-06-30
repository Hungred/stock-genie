import { Router } from 'express'
import db from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC
  `).all(req.user.userId)
  res.json(rows)
})

router.post('/', authMiddleware, (req, res) => {
  const { date, code, name, category = '', type, shares, price, fee = 0 } = req.body
  if (!date || !code || !name || !type || !shares || !price) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const result = db.prepare(`
    INSERT INTO transactions (user_id, date, code, name, category, type, shares, price, fee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.userId, date, code.toUpperCase(), name, category, type, shares, price, fee)
  res.status(201).json({ id: result.lastInsertRowid })
})

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId)
  res.json({ ok: true })
})

export default router
