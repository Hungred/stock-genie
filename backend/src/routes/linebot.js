import { Router } from 'express'
import { messagingApi, middleware } from '@line/bot-sdk'
import db from '../db/index.js'
import { getStockPrice } from '../services/stockPrice.js'

const router = Router()

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
}

function getClient() {
  return new messagingApi.MessagingApiClient({ channelAccessToken: lineConfig.channelAccessToken })
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

function reply(client, replyToken, text) {
  return client.replyMessage({ replyToken, messages: [{ type: 'text', text }] })
}

async function handleMessage(event) {
  const client = getClient()
  const text = event.message.text.trim()

  if (text === '損益' || text === '今日損益') {
    const holdings = calcHoldings()
    let msg = '📊 目前持股損益\n\n'
    let totalCost = 0, totalValue = 0

    for (const h of holdings) {
      const price = await getStockPrice(h.code)
      totalCost += h.total_cost
      if (price) {
        const value = price * h.shares
        const pnl = value - h.total_cost
        const pct = ((pnl / h.total_cost) * 100).toFixed(2)
        totalValue += value
        msg += `${h.code} ${h.name}\n`
        msg += `  ${h.shares}股 × ${price} = ${value.toLocaleString()}\n`
        msg += `  損益：${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} (${pct}%)\n\n`
      }
    }

    const totalPnl = totalValue - totalCost
    const totalPct = totalCost ? ((totalPnl / totalCost) * 100).toFixed(2) : '0'
    msg += `───────────\n`
    msg += `總損益：${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)} 元\n`
    msg += `報酬率：${totalPct}%`
    return reply(client, event.replyToken, msg)
  }

  if (text === '持股') {
    const holdings = calcHoldings()
    let msg = '📋 目前持股\n\n'
    for (const h of holdings) {
      const avg = (h.total_cost / h.shares).toFixed(2)
      msg += `${h.code} ${h.name}  ${h.shares}股\n均成本：${avg}\n\n`
    }
    return reply(client, event.replyToken, msg.trim())
  }

  if (/^\d{4,6}[ab]?$/i.test(text)) {
    const price = await getStockPrice(text)
    const holdings = calcHoldings()
    const h = holdings.find(x => x.code.toUpperCase() === text.toUpperCase())
    if (!h) return reply(client, event.replyToken, `找不到 ${text} 的持股資料`)

    const avg = (h.total_cost / h.shares).toFixed(2)
    const pnl = price ? (price - parseFloat(avg)) * h.shares : null
    let msg = `📈 ${h.code} ${h.name}\n`
    msg += `持有：${h.shares} 股\n`
    msg += `均成本：${avg}\n`
    msg += `現價：${price ?? '無法取得'}\n`
    if (pnl !== null) msg += `損益：${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} 元`
    return reply(client, event.replyToken, msg)
  }

  return reply(client, event.replyToken,
    '📌 股小秘指令\n\n損益 → 查看全部損益\n持股 → 查看持股清單\n0050 → 查詢單支股票\n\n更多功能請上網頁操作！'
  )
}

router.post('/webhook', middleware(lineConfig), (req, res) => {
  const events = req.body.events
  Promise.all(events.filter(e => e.type === 'message' && e.message.type === 'text').map(handleMessage))
    .then(() => res.json({ ok: true }))
    .catch(e => res.status(500).json({ error: e.message }))
})

export default router
