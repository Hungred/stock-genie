import { Router } from 'express'
import db from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM dividends ORDER BY date DESC`).all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const { date, code, name, dividend_per_share, shares, amount } = req.body
  if (!date || !code || !name || !dividend_per_share || !shares || !amount) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const result = db.prepare(`
    INSERT INTO dividends (date, code, name, dividend_per_share, shares, amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(date, code.toUpperCase(), name, dividend_per_share, shares, amount)
  res.status(201).json({ id: result.lastInsertRowid })
})

export default router
