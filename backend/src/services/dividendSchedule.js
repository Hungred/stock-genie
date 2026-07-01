import axios from 'axios'
import db from '../db/index.js'

function twseDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

// 抓 TWSE 除權息公告（未來 60 天）
export async function syncDividendSchedules() {
  const today = new Date()
  const future = new Date(today)
  future.setDate(today.getDate() + 60)

  const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&strDate=${twseDateStr(today)}&endDate=${twseDateStr(future)}`

  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  })

  if (!data?.data || !Array.isArray(data.data)) {
    console.log('[dividend-sync] no data returned from TWSE')
    return 0
  }

  // TWSE 欄位順序（依 TWT49U API）：
  // 0:日期 1:代號 2:名稱 3:除息日 4:除權日 5:最後除息買進日 6:最後除權買進日
  // 7:現金股利 8:股票股利 ...
  // 使用 fields array 來找欄位
  const fields = data.fields ?? []
  const colDate = fields.indexOf('日期') !== -1 ? fields.indexOf('日期') : 0
  const colCode = fields.findIndex(f => f.includes('代號') || f.includes('股票代號'))
  const colName = fields.findIndex(f => f.includes('名稱') || f.includes('股票名稱'))
  const colExDivDate = fields.findIndex(f => f.includes('除息日期') || f === '除息日')
  const colCash = fields.findIndex(f => f.includes('現金股利') || f.includes('現金'))
  const colStock = fields.findIndex(f => f.includes('股票股利') || f.includes('股票'))

  let count = 0
  for (const row of data.data) {
    const code = colCode >= 0 ? row[colCode]?.trim() : null
    const name = colName >= 0 ? row[colName]?.trim() : ''
    const exDateRaw = colExDivDate >= 0 ? row[colExDivDate]?.trim() : null
    if (!code || !exDateRaw || exDateRaw === '-' || exDateRaw === '') continue

    // 民國年轉西元：113/07/15 → 2024-07-15
    const exDate = twRocToIso(exDateRaw)
    if (!exDate) continue

    const cash = parseDividend(colCash >= 0 ? row[colCash] : '0')
    const stock = parseDividend(colStock >= 0 ? row[colStock] : '0')

    try {
      await db.query(
        `INSERT INTO dividend_schedules (code, name, ex_date, dividend_cash, dividend_stock)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code, ex_date) DO UPDATE SET
           name = EXCLUDED.name,
           dividend_cash = EXCLUDED.dividend_cash,
           dividend_stock = EXCLUDED.dividend_stock`,
        [code, name, exDate, cash, stock]
      )
      count++
    } catch {}
  }

  console.log(`[dividend-sync] upserted ${count} records`)
  return count
}

function twRocToIso(raw) {
  // 支援 113/07/15 或 1130715 格式
  const m = raw.match(/^(\d{2,3})[\/\-](\d{2})[\/\-](\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1]) + 1911
  return `${year}-${m[2]}-${m[3]}`
}

function parseDividend(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

// 取得提醒設定（全域 + 個股）
export async function getNotifySettings(userId) {
  const { rows } = await db.query(
    'SELECT scope, enabled, remind_days_before FROM dividend_notify_settings WHERE user_id = $1',
    [userId]
  )
  const global = rows.find(r => r.scope === 'ALL') ?? { enabled: true, remind_days_before: 1 }
  const perStock = {}
  for (const r of rows.filter(r => r.scope !== 'ALL')) {
    perStock[r.scope] = { enabled: r.enabled, remind_days_before: r.remind_days_before }
  }
  return {
    globalEnabled: global.enabled,
    globalDays: global.remind_days_before ?? 1,
    perStock,
  }
}

// 計算某個 ex_date 應在哪天提醒（考慮週末）
export function getReminderDate(exDateStr, daysBefore) {
  const ex = new Date(exDateStr + 'T00:00:00Z')
  const remind = new Date(ex)
  remind.setUTCDate(ex.getUTCDate() - daysBefore)
  // 若提醒日是週六 → 往前到週五
  if (remind.getUTCDay() === 6) remind.setUTCDate(remind.getUTCDate() - 1)
  // 若提醒日是週日 → 往前到週五
  if (remind.getUTCDay() === 0) remind.setUTCDate(remind.getUTCDate() - 2)
  return remind.toISOString().slice(0, 10)
}

// 取得今天（台灣時間）日期字串
export function todayTW() {
  const now = new Date()
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return tw.toISOString().slice(0, 10)
}
