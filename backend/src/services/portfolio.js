import db from '../db/index.js'

export function calcHoldings(userId) {
  const rows = db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY date ASC`).all(userId)
  const map = {}
  for (const t of rows) {
    if (!map[t.code]) {
      map[t.code] = { code: t.code, name: t.name, category: t.category || '', shares: 0, total_cost: 0 }
    }
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
