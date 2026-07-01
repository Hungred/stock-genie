import { Router } from 'express'
import { messagingApi, middleware } from '@line/bot-sdk'
import axios from 'axios'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'
import { getStockPrice, getStockInfo, getFullQuote, getMultiplePrices } from '../services/stockPrice.js'
import { calcHoldings } from '../services/portfolio.js'
import { signToken } from '../middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const router = Router()

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
}

const WEB_URL = process.env.WEB_URL || 'https://stock-genie-web.onrender.com'
const API_URL = process.env.API_URL || 'https://stock-genie-api.onrender.com'
const LIFF_ID = process.env.LIFF_ID || ''

function getClient() {
  return new messagingApi.MessagingApiClient({ channelAccessToken: lineConfig.channelAccessToken })
}

const QUICK_REPLY = {
  items: [
    { type: 'action', action: { type: 'message', label: '📊 損益', text: '損益' } },
    { type: 'action', action: { type: 'message', label: '📋 持股', text: '持股' } },
    { type: 'action', action: { type: 'message', label: '⭐ 自選', text: '自選' } },
    { type: 'action', action: { type: 'uri', label: '👤 我的帳號', uri: LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : WEB_URL } },
    { type: 'action', action: { type: 'uri', label: '🖥️ 開啟網頁', uri: WEB_URL } },
  ],
}

function reply(client, replyToken, text) {
  return client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text, quickReply: QUICK_REPLY }],
  })
}

function replyFlex(client, replyToken, altText, contents) {
  return client.replyMessage({
    replyToken,
    messages: [{ type: 'flex', altText, contents, quickReply: QUICK_REPLY }],
  })
}

function replyWithImage(client, replyToken, text, imageUrl) {
  return client.replyMessage({
    replyToken,
    messages: [
      { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl },
      { type: 'text', text, quickReply: QUICK_REPLY },
    ],
  })
}

async function findOrCreateUser(client, lineUserId) {
  const { rows } = await db.query('SELECT * FROM users WHERE line_user_id = $1', [lineUserId])
  if (rows.length) return rows[0]
  let displayName = ''
  try {
    const profile = await client.getProfile(lineUserId)
    displayName = profile.displayName || ''
  } catch {}
  const result = await db.query(
    'INSERT INTO users (line_user_id, display_name) VALUES ($1, $2) ON CONFLICT (line_user_id) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING *',
    [lineUserId, displayName]
  )
  return result.rows[0]
}

async function ensureDefaultList(userId) {
  await db.query(
    "INSERT INTO watchlists (user_id, name, sort_order) VALUES ($1, '我的最愛', 0) ON CONFLICT (user_id, name) DO NOTHING",
    [userId]
  )
}

function buildStockFlex(code, quote, holding) {
  const price = quote.price
  const priceStr = price != null ? price.toString() : '無法取得'
  const changeColor = quote.change == null ? '#666666' : quote.change >= 0 ? '#e03131' : '#2f9e44'
  const changeStr = quote.change != null
    ? `${quote.change >= 0 ? '▲' : '▼'}${Math.abs(quote.change).toFixed(2)}  ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent?.toFixed(2)}%`
    : ''

  const bodyContents = []

  // 開高低量
  if (quote.open != null) {
    bodyContents.push({
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '開', size: 'xs', color: '#888888', flex: 1 },
        { type: 'text', text: `${quote.open}`, size: 'xs', flex: 2 },
        { type: 'text', text: '高', size: 'xs', color: '#e03131', flex: 1 },
        { type: 'text', text: `${quote.high}`, size: 'xs', color: '#e03131', flex: 2 },
      ],
    })
    bodyContents.push({
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '低', size: 'xs', color: '#2f9e44', flex: 1 },
        { type: 'text', text: `${quote.low}`, size: 'xs', color: '#2f9e44', flex: 2 },
        { type: 'text', text: '量', size: 'xs', color: '#888888', flex: 1 },
        { type: 'text', text: `${quote.volumeLots ?? '-'}張`, size: 'xs', flex: 2 },
      ],
    })
  }

  // 持倉資訊
  if (holding && price != null) {
    const avgCost = (holding.total_cost / holding.shares)
    const pnl = price * holding.shares - holding.total_cost
    const pnlPct = (pnl / holding.total_cost * 100)
    bodyContents.push({ type: 'separator', margin: 'md' })
    bodyContents.push({
      type: 'box', layout: 'horizontal', margin: 'md',
      contents: [
        { type: 'text', text: '持倉', size: 'xs', color: '#888888', flex: 1 },
        { type: 'text', text: `${holding.shares}股 · 均 ${avgCost.toFixed(2)}`, size: 'xs', flex: 3 },
      ],
    })
    bodyContents.push({
      type: 'box', layout: 'horizontal',
      contents: [
        { type: 'text', text: '損益', size: 'xs', color: '#888888', flex: 1 },
        {
          type: 'text',
          text: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
          size: 'xs', weight: 'bold',
          color: pnl >= 0 ? '#e03131' : '#2f9e44',
          flex: 3,
        },
      ],
    })
  }

  return {
    type: 'bubble',
    header: {
      type: 'box', layout: 'horizontal', paddingAll: '14px',
      backgroundColor: '#f8f9fa',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 1,
          contents: [
            { type: 'text', text: quote.name || code, weight: 'bold', size: 'lg', color: '#1a1a1a' },
            { type: 'text', text: code, size: 'xs', color: '#888888' },
          ],
        },
        {
          type: 'box', layout: 'vertical', alignItems: 'flex-end',
          contents: [
            { type: 'text', text: priceStr, weight: 'bold', size: 'xl', color: changeColor },
            { type: 'text', text: changeStr, size: 'xs', color: changeColor },
          ],
        },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '12px',
      spacing: 'sm',
      contents: bodyContents.length ? bodyContents : [
        { type: 'text', text: '暫無詳細資料', size: 'sm', color: '#888888' },
      ],
    },
    footer: {
      type: 'box', layout: 'horizontal', spacing: 'xs', paddingAll: '8px',
      contents: [
        { type: 'button', action: { type: 'message', label: '即時', text: code }, style: 'secondary', height: 'sm', flex: 1 },
        { type: 'button', action: { type: 'message', label: 'K線', text: `${code} K線` }, style: 'secondary', height: 'sm', flex: 1 },
        { type: 'button', action: { type: 'message', label: 'EPS', text: `${code} EPS` }, style: 'secondary', height: 'sm', flex: 1 },
        { type: 'button', action: { type: 'message', label: '股利', text: `${code} 股利` }, style: 'secondary', height: 'sm', flex: 1 },
        { type: 'button', action: { type: 'message', label: '+自選', text: `加自選 ${code}` }, style: 'primary', color: '#FF6B35', height: 'sm', flex: 1 },
      ],
    },
  }
}

const HELP_MSG =
  '📌 指令說明\n\n' +
  '【查詢】\n' +
  '損益 → 全部持股損益\n' +
  '持股 → 持股清單\n' +
  '0050 → 股票卡片（即時/K線/EPS/股利）\n\n' +
  '【自選清單】\n' +
  '自選 → 顯示所有清單\n' +
  '自選 我的最愛 → 清單股票 + 現價漲跌\n' +
  '自選 持股 → 持倉股票 + 現價漲跌\n' +
  '加自選 0050 → 加入我的最愛\n' +
  '加自選 0050 清單名 → 加入指定清單\n' +
  '移自選 0050 → 從我的最愛移除\n' +
  '新增清單 清單名 → 建立新清單\n' +
  '刪除清單 清單名 → 刪除清單\n\n' +
  '【新增交易】\n' +
  '買 0050 100 145.2\n' +
  '買 0050 100 145.2 20  ← 含手續費\n' +
  '賣 0050 50 160\n' +
  '（格式：買/賣 代號 股數 單價 [手續費]）\n' +
  '名稱自動帶入，不用手打\n\n' +
  '日期可選填（不填用今天）：\n' +
  '買 昨天 0050 100 145.2\n' +
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
  '配息 00878 0.48 350\n\n' +
  '【帳號】\n' +
  '綁定 / 登入 / 我的帳號 → 開啟綁定連結\n' +
  '指令說明 / 說明 / help → 顯示此說明'

function resolveDate(raw) {
  const d = new Date()
  const map = { '今天': 0, '昨天': -1, '前天': -2, '大前天': -3 }
  if (raw === undefined || raw === null) return d.toLocaleDateString('sv-SE')
  if (map[raw] !== undefined) {
    d.setDate(d.getDate() + map[raw])
    return d.toLocaleDateString('sv-SE')
  }
  return raw
}

async function handleMessage(event) {
  const client = getClient()
  const lineUserId = event.source.userId
  const text = event.message.text.trim()
  const today = new Date().toLocaleDateString('sv-SE')

  const user = await findOrCreateUser(client, lineUserId)

  // 查詢損益
  if (text === '損益' || text === '今日損益') {
    const holdings = await calcHoldings(user.id)
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

    const chartToken = signToken({ userId: user.id }, '10m')
    return replyWithImage(client, event.replyToken, msg, `${API_URL}/api/charts/bar?token=${chartToken}`)
  }

  // 查詢持股
  if (text === '持股') {
    const holdings = await calcHoldings(user.id)
    if (!holdings.length) return reply(client, event.replyToken, '目前沒有持股資料，請先新增交易記錄。')
    let msg = '📋 目前持股\n\n'
    for (const h of holdings) {
      const avg = (h.total_cost / h.shares).toFixed(2)
      msg += `${h.code} ${h.name}  ${h.shares}股\n均成本：${avg}\n\n`
    }
    const chartToken = signToken({ userId: user.id }, '10m')
    return replyWithImage(client, event.replyToken, msg.trim(), `${API_URL}/api/charts/pie?token=${chartToken}`)
  }

  // 指令說明
  if (text === '指令說明' || text === '說明' || text === 'help') {
    return reply(client, event.replyToken, HELP_MSG)
  }

  // 綁定帳號
  if (text === '綁定' || text === '登入' || text === '我的帳號') {
    const liffUrl = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : WEB_URL
    return reply(client, event.replyToken, `👤 點下方連結完成帳號綁定：\n${liffUrl}\n\n綁定後即可在網頁查看完整投資組合。`)
  }

  // 自選清單 - 顯示所有清單
  if (text === '自選') {
    await ensureDefaultList(user.id)
    const { rows } = await db.query(
      `SELECT w.name, COUNT(ws.id)::int AS cnt
       FROM watchlists w LEFT JOIN watchlist_stocks ws ON ws.watchlist_id = w.id
       WHERE w.user_id = $1 GROUP BY w.id, w.name ORDER BY w.sort_order, w.created_at`,
      [user.id]
    )
    let msg = '⭐ 我的自選清單\n\n'
    for (const l of rows) msg += `${l.name}（${l.cnt} 支）\n`
    msg += '\n我的持股：自選 持股'
    msg += '\n查看清單：自選 清單名'
    return reply(client, event.replyToken, msg)
  }

  // 自選 清單名 or 自選 持股
  if (text.startsWith('自選 ')) {
    const listName = text.slice(3).trim()

    if (listName === '持股') {
      const holdings = await calcHoldings(user.id)
      if (!holdings.length) return reply(client, event.replyToken, '目前沒有持股資料')
      const prices = await getMultiplePrices(holdings.map(h => h.code))
      let msg = '📋 我的持股\n\n'
      for (const h of holdings) {
        const price = prices[h.code]
        const pnl = price != null ? price * h.shares - h.total_cost : null
        msg += `${h.code} ${h.name}  ${h.shares}股\n`
        if (price != null) {
          msg += `  ${price}  ${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} (${(pnl / h.total_cost * 100).toFixed(2)}%)\n`
        }
        msg += '\n'
      }
      return reply(client, event.replyToken, msg.trim())
    }

    const { rows: wl } = await db.query(
      'SELECT id FROM watchlists WHERE user_id = $1 AND name = $2',
      [user.id, listName]
    )
    if (!wl.length) return reply(client, event.replyToken, `找不到清單「${listName}」\n\n輸入「自選」查看所有清單`)

    const { rows: stocks } = await db.query(
      'SELECT code, name FROM watchlist_stocks WHERE watchlist_id = $1 ORDER BY sort_order, created_at',
      [wl[0].id]
    )
    if (!stocks.length) return reply(client, event.replyToken, `${listName} 是空的\n\n加入股票：加自選 0050`)

    const prices = await getMultiplePrices(stocks.map(s => s.code))
    let msg = `⭐ ${listName}（${stocks.length} 支）\n\n`
    for (const s of stocks) {
      const price = prices[s.code]
      msg += `${s.code} ${s.name}\n`
      msg += price != null ? `  ${price}\n\n` : '  無法取得\n\n'
    }
    return reply(client, event.replyToken, msg.trim())
  }

  // 加自選
  if (text.startsWith('加自選 ')) {
    const parts = text.slice(4).trim().split(/\s+/)
    const code = parts[0].toUpperCase()
    const listName = parts.slice(1).join(' ') || '我的最愛'
    await ensureDefaultList(user.id)
    const { rows: wl } = await db.query(
      'SELECT id FROM watchlists WHERE user_id = $1 AND name = $2',
      [user.id, listName]
    )
    if (!wl.length) return reply(client, event.replyToken, `找不到清單「${listName}」`)
    const info = await getStockInfo(code)
    await db.query(
      'INSERT INTO watchlist_stocks (watchlist_id, code, name) VALUES ($1, $2, $3) ON CONFLICT (watchlist_id, code) DO NOTHING',
      [wl[0].id, code, info.name || code]
    )
    return reply(client, event.replyToken, `✅ ${code}${info.name ? ` ${info.name}` : ''} 已加入「${listName}」`)
  }

  // 移自選
  if (text.startsWith('移自選 ')) {
    const parts = text.slice(4).trim().split(/\s+/)
    const code = parts[0].toUpperCase()
    const listName = parts.slice(1).join(' ') || '我的最愛'
    const { rows: wl } = await db.query(
      'SELECT id FROM watchlists WHERE user_id = $1 AND name = $2',
      [user.id, listName]
    )
    if (!wl.length) return reply(client, event.replyToken, `找不到清單「${listName}」`)
    await db.query('DELETE FROM watchlist_stocks WHERE watchlist_id = $1 AND code = $2', [wl[0].id, code])
    return reply(client, event.replyToken, `✅ ${code} 已從「${listName}」移除`)
  }

  // 新增清單
  if (text.startsWith('新增清單 ')) {
    const name = text.slice(5).trim()
    if (!name) return reply(client, event.replyToken, '請輸入清單名稱')
    try {
      await db.query('INSERT INTO watchlists (user_id, name) VALUES ($1, $2)', [user.id, name])
      return reply(client, event.replyToken, `✅ 清單「${name}」已建立\n\n加入股票：加自選 0050 ${name}`)
    } catch {
      return reply(client, event.replyToken, `清單「${name}」已存在`)
    }
  }

  // 刪除清單
  if (text.startsWith('刪除清單 ')) {
    const name = text.slice(5).trim()
    if (name === '我的最愛') return reply(client, event.replyToken, '❌ 無法刪除「我的最愛」')
    const result = await db.query('DELETE FROM watchlists WHERE user_id = $1 AND name = $2', [user.id, name])
    if (result.rowCount === 0) return reply(client, event.replyToken, `找不到清單「${name}」`)
    return reply(client, event.replyToken, `✅ 清單「${name}」已刪除`)
  }

  // K線 / EPS / 股利（佔位）
  const advMatch = text.match(/^(\d{4,6}[ab]?)\s+(K線|EPS|股利)$/i)
  if (advMatch) {
    const code = advMatch[1].toUpperCase()
    const mode = advMatch[2]
    return reply(client, event.replyToken, `${code} ${mode}\n\n此功能即將推出，敬請期待 🚀`)
  }

  // 新增買賣交易
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
        await db.query(
          'INSERT INTO transactions (user_id, date, code, name, type, shares, price, fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [user.id, txDate, code.toUpperCase(), name, action === '買' ? 'buy' : 'sell', parseInt(shares), parseFloat(price), fee ? parseFloat(fee) : 0]
        )
        const total = (parseInt(shares) * parseFloat(price) + (fee ? parseFloat(fee) : 0)).toLocaleString()
        results.push(`✅ ${action} ${code} ${name}  ${shares}股 × ${price} = ${total} (${txDate})`)
      } catch (e) {
        results.push(`❌ ${action} ${code} 失敗：${e.message}`)
      }
    }
    return reply(client, event.replyToken, `新增 ${tradeLines.length} 筆交易記錄\n\n${results.join('\n')}`)
  }

  // 新增配息
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
        await db.query(
          'INSERT INTO dividends (user_id, date, code, name, dividend_per_share, shares, amount) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [user.id, today, code.toUpperCase(), name, parseFloat(dividendPerShare), parseInt(shares), amount]
        )
        results.push(`✅ ${code} ${name}  每股${dividendPerShare} × ${shares}股 = ${amount.toLocaleString()}`)
      } catch (e) {
        results.push(`❌ ${code} 失敗：${e.message}`)
      }
    }
    return reply(client, event.replyToken, `新增 ${divLines.length} 筆配息記錄\n\n${results.join('\n')}`)
  }

  // 查詢單支股票 → Flex Message
  if (/^\d{4,6}[ab]?$/i.test(text)) {
    const code = text.toUpperCase()
    const quote = await getFullQuote(code)
    if (!quote || !quote.name) return reply(client, event.replyToken, `找不到股票代號 ${code}`)

    const holdings = await calcHoldings(user.id)
    const holding = holdings.find(h => h.code.toUpperCase() === code)

    const flexContents = buildStockFlex(code, quote, holding)
    return replyFlex(client, event.replyToken, `${quote.name}(${code}) ${quote.price ?? ''}`, flexContents)
  }

  return reply(client, event.replyToken, HELP_MSG)
}

async function handleFollow(event) {
  const client = getClient()
  const lineUserId = event.source.userId
  await findOrCreateUser(client, lineUserId)
  const liffUrl = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : WEB_URL
  const welcomeMsg =
    '👋 歡迎使用股小秘！\n\n' +
    '我可以幫你隨時查看、管理台股投資組合 📊\n\n' +
    `帳號已自動建立，點下方「我的帳號」可開啟網頁版 🖥️\n\n` +
    '─────────────\n' +
    HELP_MSG
  return reply(client, event.replyToken, welcomeMsg)
}

// 初始化 Rich Menu（部署後呼叫一次）
router.post('/setup-richmenu', async (req, res) => {
  try {
    const client = getClient()
    const liffUrl = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : WEB_URL

    const richMenu = await client.createRichMenu({
      size: { width: 2500, height: 1686 },
      selected: true,
      name: '股小秘選單',
      chatBarText: '股小秘選單',
      areas: [
        { bounds: { x: 0,    y: 0,   width: 833, height: 843 }, action: { type: 'message', label: '損益查詢', text: '損益' } },
        { bounds: { x: 833,  y: 0,   width: 834, height: 843 }, action: { type: 'message', label: '持股明細', text: '持股' } },
        { bounds: { x: 1667, y: 0,   width: 833, height: 843 }, action: { type: 'message', label: '自選清單', text: '自選' } },
        { bounds: { x: 0,    y: 843, width: 833, height: 843 }, action: { type: 'uri', label: '我的帳號', uri: liffUrl } },
        { bounds: { x: 833,  y: 843, width: 834, height: 843 }, action: { type: 'uri', label: '開啟網頁', uri: WEB_URL } },
        { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: 'message', label: '指令說明', text: '指令說明' } },
      ],
    })

    const imgPath = join(__dirname, '../../richmenu.png')
    const imgBuffer = readFileSync(imgPath)
    await axios.post(
      `https://api-data.line.me/v2/bot/richmenu/${richMenu.richMenuId}/content`,
      imgBuffer,
      { headers: { Authorization: `Bearer ${lineConfig.channelAccessToken}`, 'Content-Type': 'image/png' } }
    )

    await client.setDefaultRichMenu(richMenu.richMenuId)
    res.json({ ok: true, richMenuId: richMenu.richMenuId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 設定指定 Rich Menu 為預設（一次性用途）
router.post('/set-default-richmenu', async (req, res) => {
  try {
    const { richMenuId } = req.body
    if (!richMenuId) return res.status(400).json({ error: 'richMenuId required' })
    const client = getClient()
    await client.setDefaultRichMenu(richMenuId)
    res.json({ ok: true, richMenuId })
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
