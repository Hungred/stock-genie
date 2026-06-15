import { Router } from 'express'
import { messagingApi, middleware } from '@line/bot-sdk'
import db from '../db/index.js'
import { getStockPrice, getStockInfo } from '../services/stockPrice.js'

const router = Router()

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
}

const WEB_URL = process.env.WEB_URL || 'https://stock-genie-web.onrender.com'
const API_URL = process.env.API_URL || 'https://stock-genie-api.onrender.com'

function getClient() {
  return new messagingApi.MessagingApiClient({ channelAccessToken: lineConfig.channelAccessToken })
}

// 固定在每則訊息下方的快捷按鈕
const QUICK_REPLY = {
  items: [
    { type: 'action', action: { type: 'message', label: '📊 損益', text: '損益' } },
    { type: 'action', action: { type: 'message', label: '📋 持股', text: '持股' } },
    { type: 'action', action: { type: 'message', label: '📖 指令說明', text: '指令說明' } },
    { type: 'action', action: { type: 'uri', label: '🖥️ 開啟網頁', uri: WEB_URL } },
  ],
}

function reply(client, replyToken, text) {
  return client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text, quickReply: QUICK_REPLY }],
  })
}

function replyWithImage(client, replyToken, text, imageUrl) {
  return client.replyMessage({
    replyToken,
    messages: [
      {
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      },
      { type: 'text', text, quickReply: QUICK_REPLY },
    ],
  })
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

const HELP_MSG =
  '📌 指令說明\n\n' +
  '【查詢】\n' +
  '損益 → 全部持股損益\n' +
  '持股 → 持股清單\n' +
  '0050 → 單支股票狀況\n\n' +
  '【新增交易】\n' +
  '買 0050 100 145.2\n' +
  '買 0050 100 145.2 20  ← 含手續費\n' +
  '賣 0050 50 160\n' +
  '（格式：買/賣 代號 股數 單價 [手續費]）\n' +
  '名稱自動帶入，不用手打\n\n' +
  '日期可選填（不填用今天）：\n' +
  '買 昨天 0050 100 145.2 20\n' +
  '買 前天 0050 100 145.2\n' +
  '買 大前天 0050 100 145.2\n' +
  '買 2026-01-15 0050 100 145.2\n\n' +
  '多筆換行一次送出：\n' +
  '買 2026-01-15 0050 100 145.2\n' +
  '買 2026-03-10 00878 200 19.5\n' +
  '賣 2026-06-01 2330 1 850\n\n' +
  '【新增配息】\n' +
  '配息 0050 1.5 255\n' +
  '（格式：配息 代號 每股金額 股數）\n\n' +
  '多筆配息也支援換行：\n' +
  '配息 0050 1.5 255\n' +
  '配息 00878 0.48 350'

function resolveDate(raw) {
  const d = new Date()
  const map = { '今天': 0, '昨天': -1, '前天': -2, '大前天': -3 }
  if (raw === undefined || raw === null) return d.toISOString().slice(0, 10)
  if (map[raw] !== undefined) {
    d.setDate(d.getDate() + map[raw])
    return d.toISOString().slice(0, 10)
  }
  return raw // YYYY-MM-DD
}

async function handleMessage(event) {
  const client = getClient()
  const text = event.message.text.trim()
  const today = new Date().toISOString().slice(0, 10)

  // 查詢損益
  if (text === '損益' || text === '今日損益') {
    const holdings = calcHoldings()
    if (!holdings.length) return reply(client, event.replyToken, '目前沒有持股資料，請先新增交易記錄。')

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
    return replyWithImage(client, event.replyToken, msg, `${API_URL}/api/charts/bar`)
  }

  // 查詢持股
  if (text === '持股') {
    const holdings = calcHoldings()
    if (!holdings.length) return reply(client, event.replyToken, '目前沒有持股資料，請先新增交易記錄。')
    let msg = '📋 目前持股\n\n'
    for (const h of holdings) {
      const avg = (h.total_cost / h.shares).toFixed(2)
      msg += `${h.code} ${h.name}  ${h.shares}股\n均成本：${avg}\n\n`
    }
    return replyWithImage(client, event.replyToken, msg.trim(), `${API_URL}/api/charts/pie`)
  }

  // 指令說明
  if (text === '指令說明' || text === '說明' || text === 'help') {
    return reply(client, event.replyToken, HELP_MSG)
  }

  // 新增買賣交易（單筆或多筆，每行一筆）
  // 格式 A（含名稱）：買 [YYYY-MM-DD] 0050 元大台灣50 100 145.2 [手續費]
  // 格式 B（免名稱）：買 [YYYY-MM-DD] 0050 100 145.2 [手續費]
  const DATE_TOKEN = /\d{4}-\d{2}-\d{2}|今天|昨天|前天|大前天/
  const TRADE_A = new RegExp(`^(買|賣)\\s+(?:(${DATE_TOKEN.source})\\s+)?(\\S+)\\s+([^\\d]\\S*)\\s+(\\d+)\\s+([\\d.]+)(?:\\s+([\\d.]+))?$`)
  const TRADE_B = new RegExp(`^(買|賣)\\s+(?:(${DATE_TOKEN.source})\\s+)?(\\S+)\\s+(\\d+)\\s+([\\d.]+)(?:\\s+([\\d.]+))?$`)

  const tradeLines = text.split('\n').map(l => l.trim()).filter(l => TRADE_A.test(l) || TRADE_B.test(l))
  if (tradeLines.length > 0) {
    const results = []
    for (const line of tradeLines) {
      const mA = line.match(TRADE_A)
      const mB = line.match(TRADE_B)
      let action, date, code, name, shares, price, fee
      if (mA) {
        [, action, date, code, name, shares, price, fee] = mA
      } else {
        [, action, date, code, shares, price, fee] = mB
        const info = await getStockInfo(code)
        name = info.name ?? code
      }
      try {
        const txDate = resolveDate(date)
        db.prepare(`INSERT INTO transactions (date, code, name, type, shares, price, fee) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(txDate, code.toUpperCase(), name, action === '買' ? 'buy' : 'sell', parseInt(shares), parseFloat(price), fee ? parseFloat(fee) : 0)
        const total = (parseInt(shares) * parseFloat(price) + (fee ? parseFloat(fee) : 0)).toLocaleString()
        results.push(`✅ ${action} ${code} ${name}  ${shares}股 × ${price} = ${total} (${txDate})`)
      } catch (e) {
        results.push(`❌ ${action} ${code} 失敗：${e.message}`)
      }
    }
    return reply(client, event.replyToken, `新增 ${tradeLines.length} 筆交易記錄\n\n${results.join('\n')}`)
  }

  // 新增配息（單筆或多筆）
  // 格式 A（含名稱）：配息 0050 元大台灣50 1.5 255
  // 格式 B（免名稱）：配息 0050 1.5 255
  const DIV_A = /^配息\s+(\S+)\s+([^\d]\S*)\s+([\d.]+)\s+(\d+)$/
  const DIV_B = /^配息\s+(\S+)\s+([\d.]+)\s+(\d+)$/

  const divLines = text.split('\n').map(l => l.trim()).filter(l => DIV_A.test(l) || DIV_B.test(l))
  if (divLines.length > 0) {
    const results = []
    for (const line of divLines) {
      const mA = line.match(DIV_A)
      const mB = line.match(DIV_B)
      let code, name, dividendPerShare, shares
      if (mA) {
        [, code, name, dividendPerShare, shares] = mA
      } else {
        [, code, dividendPerShare, shares] = mB
        const info = await getStockInfo(code)
        name = info.name ?? code
      }
      const amount = parseFloat(dividendPerShare) * parseInt(shares)
      try {
        db.prepare(`INSERT INTO dividends (date, code, name, dividend_per_share, shares, amount) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(today, code.toUpperCase(), name, parseFloat(dividendPerShare), parseInt(shares), amount)
        results.push(`✅ ${code} ${name}  每股${dividendPerShare} × ${shares}股 = ${amount.toLocaleString()}`)
      } catch (e) {
        results.push(`❌ ${code} 失敗：${e.message}`)
      }
    }
    return reply(client, event.replyToken, `新增 ${divLines.length} 筆配息記錄\n\n${results.join('\n')}`)
  }

  // 查詢單支股票
  if (/^\d{4,6}[ab]?$/i.test(text)) {
    const price = await getStockPrice(text)
    const holdings = calcHoldings()
    const h = holdings.find(x => x.code.toUpperCase() === text.toUpperCase())

    let msg = `📈 ${text.toUpperCase()}\n現價：${price ?? '無法取得'}\n`
    if (h) {
      const avg = (h.total_cost / h.shares).toFixed(2)
      const pnl = price ? (price - parseFloat(avg)) * h.shares : null
      msg += `\n持有：${h.shares} 股\n均成本：${avg}\n`
      if (pnl !== null) msg += `損益：${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} 元`
    }
    return reply(client, event.replyToken, msg)
  }

  return reply(client, event.replyToken, HELP_MSG)
}

async function handleFollow(event) {
  const client = getClient()
  const welcomeMsg =
    '👋 歡迎使用股小秘！\n\n' +
    '我可以幫你隨時查看、管理台股投資組合 📊\n\n' +
    '─────────────\n' +
    HELP_MSG
  return reply(client, event.replyToken, welcomeMsg)
}

// 初始化 Rich Menu（部署後呼叫一次即可）
router.post('/setup-richmenu', async (req, res) => {
  try {
    const client = getClient()

    const richMenu = await client.createRichMenu({
      size: { width: 2500, height: 843 },
      selected: true,
      name: '股小秘選單',
      chatBarText: '股小秘選單',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 833, height: 843 },
          action: { type: 'message', label: '損益', text: '損益' },
        },
        {
          bounds: { x: 833, y: 0, width: 833, height: 843 },
          action: { type: 'message', label: '持股', text: '持股' },
        },
        {
          bounds: { x: 1666, y: 0, width: 834, height: 843 },
          action: { type: 'uri', label: '開啟網頁', uri: WEB_URL },
        },
      ],
    })

    await client.setDefaultRichMenu(richMenu.richMenuId)
    res.json({ ok: true, richMenuId: richMenu.richMenuId, note: '請至 LINE Developers 上傳 Rich Menu 圖片' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/webhook', middleware(lineConfig), (req, res) => {
  const events = req.body.events
  Promise.all(events.map(e => {
    if (e.type === 'follow') return handleFollow(e)
    if (e.type === 'message' && e.message.type === 'text') return handleMessage(e)
  }))
    .then(() => res.json({ ok: true }))
    .catch(e => res.status(500).json({ error: e.message }))
})

export default router
