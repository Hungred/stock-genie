import { Router } from 'express'
import db from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM dividends WHERE user_id = ? ORDER BY date DESC`).all(req.user.userId)
  res.json(rows)
})

router.post('/', authMiddleware, (req, res) => {
  const { date, code, name, dividend_per_share, shares, amount } = req.body
  if (!date || !code || !name || !dividend_per_share || !shares || !amount) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const result = db.prepare(`
    INSERT INTO dividends (user_id, date, code, name, dividend_per_share, shares, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.userId, date, code.toUpperCase(), name, dividend_per_share, shares, amount)
  res.status(201).json({ id: result.lastInsertRowid })
})

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM dividends WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId)
  res.json({ ok: true })
})

export default router
