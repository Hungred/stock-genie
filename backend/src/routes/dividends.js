import { Router } from 'express'
import db from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  processTwseData,
  getNotifySettings,
  getReminderDate,
  todayTW,
} from '../services/dividendSchedule.js'
import { calcHoldings } from '../services/portfolio.js'

const router = Router()

// ── 配息記錄 CRUD ──────────────────────────────────────────────

router.get('/', authMiddleware, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM dividends WHERE user_id = $1 ORDER BY date DESC',
    [req.user.userId]
  )
  res.json(rows.map(r => ({
    ...r,
    dividend_per_share: Number(r.dividend_per_share),
    shares: Number(r.shares),
    amount: Number(r.amount),
  })))
})

router.post('/', authMiddleware, async (req, res) => {
  const { date, code, name, dividend_per_share, shares, amount } = req.body
  if (!date || !code || !name || !dividend_per_share || !shares || !amount) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }
  const { rows } = await db.query(
    'INSERT INTO dividends (user_id, date, code, name, dividend_per_share, shares, amount, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [req.user.userId, date, code.toUpperCase(), name, dividend_per_share, shares, amount, 'manual']
  )
  res.status(201).json({ id: rows[0].id })
})

router.put('/:id', authMiddleware, async (req, res) => {
  const { date, dividend_per_share, shares, amount } = req.body
  await db.query(
    `UPDATE dividends SET
       date = COALESCE($1, date),
       dividend_per_share = COALESCE($2, dividend_per_share),
       shares = COALESCE($3, shares),
       amount = COALESCE($4, amount),
       source = 'manual'
     WHERE id = $5 AND user_id = $6`,
    [date, dividend_per_share, shares, amount, req.params.id, req.user.userId]
  )
  res.json({ ok: true })
})

router.delete('/:id', authMiddleware, async (req, res) => {
  await db.query('DELETE FROM dividends WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId])
  res.json({ ok: true })
})

// ── 近期除息（持股中 30 天內有除息）──────────────────────────

router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    const today = todayTW()
    const future = new Date(today)
    future.setDate(future.getDate() + 30)
    const futureStr = future.toISOString().slice(0, 10)

    const holdings = await calcHoldings(req.user.userId)
    if (!holdings.length) return res.json([])

    const codes = holdings.map(h => h.code)
    const { rows } = await db.query(
      `SELECT * FROM dividend_schedules
       WHERE code = ANY($1) AND ex_date >= $2 AND ex_date <= $3
       ORDER BY ex_date ASC`,
      [codes, today, futureStr]
    )

    const result = rows.map(r => {
      const holding = holdings.find(h => h.code === r.code)
      const shares = holding?.shares ?? 0
      const estimatedAmount = Number(r.dividend_cash) * shares
      return {
        ...r,
        dividend_cash: Number(r.dividend_cash),
        dividend_stock: Number(r.dividend_stock),
        shares,
        estimated_amount: estimatedAmount,
      }
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 提醒設定 ────────────────────────────────────────────────────

router.get('/notify-settings', authMiddleware, async (req, res) => {
  try {
    const settings = await getNotifySettings(req.user.userId)
    res.json(settings)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/notify-settings', authMiddleware, async (req, res) => {
  // { scope: 'ALL'|'0050', enabled?: bool, remind_days_before?: int }
  const { scope, enabled, remind_days_before } = req.body
  if (!scope) return res.status(400).json({ error: 'scope required' })
  await db.query(
    `INSERT INTO dividend_notify_settings (user_id, scope, enabled, remind_days_before)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, scope) DO UPDATE SET
       enabled = COALESCE(EXCLUDED.enabled, dividend_notify_settings.enabled),
       remind_days_before = COALESCE(EXCLUDED.remind_days_before, dividend_notify_settings.remind_days_before)`,
    [req.user.userId, scope, enabled ?? null, remind_days_before ?? null]
  )
  res.json({ ok: true })
})

// ── 排程端點（GitHub Actions 呼叫，無需認證）─────────────────

// POST /api/dividends/sync-data   接收 GitHub Actions 傳來的 TWSE 資料（繞過 IP 封鎖）
router.post('/sync-data', async (req, res) => {
  const secret = req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' })
  try {
    const count = await processTwseData(req.body)
    res.json({ ok: true, count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/dividends/send-reminders   推播今日提醒
router.post('/send-reminders', async (req, res) => {
  const secret = req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' })
  try {
    const today = todayTW()
    const { rows: users } = await db.query('SELECT id, line_user_id FROM users')

    const { messagingApi } = await import('@line/bot-sdk')
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    })

    let pushed = 0
    for (const user of users) {
      const settings = await getNotifySettings(user.id)
      if (!settings.globalEnabled) continue

      const holdings = await calcHoldings(user.id)
      if (!holdings.length) continue

      const toRemind = []
      for (const h of holdings) {
        const stockSettings = settings.perStock[h.code]
        if (stockSettings?.enabled === false) continue

        const days = stockSettings?.remind_days_before ?? settings.globalDays
        // 找今天應提醒的除息日：提醒日 = 今天 → ex_date 是幾天後
        const { rows: schedules } = await db.query(
          `SELECT * FROM dividend_schedules WHERE code = $1 AND ex_date > $2 ORDER BY ex_date ASC LIMIT 5`,
          [h.code, today]
        )
        for (const s of schedules) {
          const remindDate = getReminderDate(s.ex_date.toISOString().slice(0, 10), days)
          if (remindDate === today) {
            toRemind.push({ holding: h, schedule: s, days })
          }
        }
      }

      if (!toRemind.length) continue

      let msg = `📅 配息提醒（${toRemind.length} 支股票即將除息）\n\n`
      for (const { holding, schedule, days } of toRemind) {
        const cash = Number(schedule.dividend_cash)
        const est = (cash * holding.shares).toFixed(0)
        const exDate = schedule.ex_date.toISOString().slice(0, 10)
        const label = days === 1 ? '明天除息，今天是最後買進日' : `${days} 天後除息`
        msg += `${holding.code} ${holding.name}\n`
        msg += `除息日：${exDate}（${label}）\n`
        msg += `每股現金：${cash} 元\n`
        msg += `你持有 ${holding.shares} 股 → 預計領 ${est} 元\n\n`
      }
      msg += `─────────────\n關閉提醒：提醒關閉`

      try {
        await client.pushMessage({ to: user.line_user_id, messages: [{ type: 'text', text: msg }] })
        pushed++
      } catch {}
    }

    res.json({ ok: true, pushed })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/dividends/auto-create   除息日當天自動建立配息記錄
router.post('/auto-create', async (req, res) => {
  const secret = req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' })
  try {
    const today = todayTW()
    const { rows: schedules } = await db.query(
      'SELECT * FROM dividend_schedules WHERE ex_date = $1',
      [today]
    )

    let created = 0
    for (const s of schedules) {
      const { rows: users } = await db.query('SELECT id FROM users')
      for (const user of users) {
        const holdings = await calcHoldings(user.id)
        const holding = holdings.find(h => h.code === s.code)
        if (!holding) continue

        const cash = Number(s.dividend_cash)
        if (cash <= 0) continue
        const amount = cash * holding.shares

        try {
          await db.query(
            `INSERT INTO dividends (user_id, date, code, name, dividend_per_share, shares, amount, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'auto')
             ON CONFLICT DO NOTHING`,
            [user.id, today, s.code, s.name, cash, holding.shares, amount]
          )
          created++
        } catch {}
      }
    }

    res.json({ ok: true, created })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
