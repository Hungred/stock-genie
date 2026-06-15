import { Router } from 'express'
import { Client, middleware } from '@line/bot-sdk'
import db from '../db/index.js'
import { getStockPrice } from '../services/stockPrice.js'

const router = Router()

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
}

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

async function handleMessage(event) {
  const client = new Client(lineConfig)
  const text = event.message.text.trim()

  // 查詢今日損益：「損益」
  if (text === '損益' || text === '今日損益') {
    const holdings = calcHoldings()
    let reply = '📊 目前持股損益\n\n'
    let totalCost = 0, totalValue = 0

    for (const h of holdings) {
      const price = await getStockPrice(h.code)
      const avgCost = h.total_cost / h.shares
      totalCost += h.total_cost
      if (price) {
        const value = price * h.shares
        const pnl = value - h.total_cost
        const pct = ((pnl / h.total_cost) * 100).toFixed(2)
        totalValue += value
        reply += `${h.code} ${h.name}\n`
        reply += `  ${h.shares}股 × ${price} = ${value.toLocaleString()}\n`
        reply += `  損益：${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} (${pct}%)\n\n`
      }
    }

    const totalPnl = totalValue - totalCost
    const totalPct = ((totalPnl / totalCost) * 100).toFixed(2)
    reply += `───────────\n`
    reply += `總損益：${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)} 元\n`
    reply += `報酬率：${totalPct}%`

    return client.replyMessage(event.replyToken, { type: 'text', text: reply })
  }

  // 查詢持股：「持股」
  if (text === '持股') {
    const holdings = calcHoldings()
    let reply = '📋 目前持股\n\n'
    for (const h of holdings) {
      const avg = (h.total_cost / h.shares).toFixed(2)
      reply += `${h.code} ${h.name}  ${h.shares}股\n均成本：${avg}\n\n`
    }
    return client.replyMessage(event.replyToken, { type: 'text', text: reply.trim() })
  }

  // 查詢單支股票：直接輸入代號
  if (/^\d{4,6}[ab]?$/i.test(text)) {
    const price = await getStockPrice(text)
    const holdings = calcHoldings()
    const h = holdings.find(x => x.code.toUpperCase() === text.toUpperCase())
    if (!h) return client.replyMessage(event.replyToken, { type: 'text', text: `找不到 ${text} 的持股資料` })

    const avg = (h.total_cost / h.shares).toFixed(2)
    const pnl = price ? (price - parseFloat(avg)) * h.shares : null
    let reply = `📈 ${h.code} ${h.name}\n`
    reply += `持有：${h.shares} 股\n`
    reply += `均成本：${avg}\n`
    reply += `現價：${price ?? '無法取得'}\n`
    if (pnl !== null) reply += `損益：${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} 元`
    return client.replyMessage(event.replyToken, { type: 'text', text: reply })
  }

  // 說明
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '📌 股小秘指令\n\n損益 → 查看全部損益\n持股 → 查看持股清單\n0050 → 查詢單支股票\n\n更多功能請上網頁操作！',
  })
}

router.post('/webhook', middleware(lineConfig), (req, res) => {
  const events = req.body.events
  Promise.all(events.filter(e => e.type === 'message' && e.message.type === 'text').map(handleMessage))
    .then(() => res.json({ ok: true }))
    .catch(e => res.status(500).json({ error: e.message }))
})

export default router
