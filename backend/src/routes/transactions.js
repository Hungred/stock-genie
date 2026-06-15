import { Router } from 'express'
import db from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM transactions ORDER BY date DESC, created_at DESC
  `).all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const { date, code, name, category = '', type, shares, price, fee = 0 } = req.body
  if (!date || !code || !name || !type || !shares || !price) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const result = db.prepare(`
    INSERT INTO transactions (date, code, name, category, type, shares, price, fee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, code.toUpperCase(), name, category, type, shares, price, fee)
  res.status(201).json({ id: result.lastInsertRowid })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
