import axios from 'axios'
import db from '../db/index.js'

function twseDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

// 抓 TWSE 除權息公告（未來 60 天）
// TWT49U 欄位：0=資料日期(除息日) 1=股票代號 2=股票名稱 5=權值+息值 6=權/息
export async function syncDividendSchedules() {
  const today = new Date()
  const future = new Date(today)
  future.setDate(today.getDate() + 60)

  const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&strDate=${twseDateStr(today)}&endDate=${twseDateStr(future)}`

  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
    maxRedirects: 5,
  })

  if (!data?.data || !Array.isArray(data.data)) {
    console.log('[dividend-sync] no data returned from TWSE, stat:', data?.stat)
    return 0
  }

  let count = 0
  for (const row of data.data) {
    const exDateRaw = row[0]?.trim()  // 資料日期 = 除息日，格式：115年07月02日
    const code = row[1]?.trim()
    const name = row[2]?.trim() ?? ''
    const amount = parseDividend(row[5])  // 權值+息值
    const type = row[6]?.trim() ?? '息'  // 息/權/權息

    if (!code || !exDateRaw) continue

    const exDate = twRocToIso(exDateRaw)
    if (!exDate) continue

    // 依類型分配現金/股票股利
    const cash = (type === '息' || type === '權息') ? amount : 0
    const stock = (type === '權' || type === '權息') ? amount : 0

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
    } catch (e) {
      console.error('[dividend-sync] insert error:', code, e.message)
    }
  }

  console.log(`[dividend-sync] upserted ${count} records`)
  return count
}

function twRocToIso(raw) {
  // 支援 115年07月02日
  const m1 = raw.match(/^(\d{2,3})年(\d{1,2})月(\d{1,2})日$/)
  if (m1) {
    const year = parseInt(m1[1]) + 1911
    return `${year}-${String(m1[2]).padStart(2,'0')}-${String(m1[3]).padStart(2,'0')}`
  }
  // 支援 113/07/15
  const m2 = raw.match(/^(\d{2,3})[\/\-](\d{2})[\/\-](\d{2})$/)
  if (m2) return `${parseInt(m2[1]) + 1911}-${m2[2]}-${m2[3]}`
  return null
}

function parseDividend(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

// 處理 TWSE 傳入的 JSON 資料（由 GitHub Actions 傳來）
export async function processTwseData(data) {
  if (!data?.data || !Array.isArray(data.data)) {
    console.log('[dividend-sync] invalid data, stat:', data?.stat)
    return 0
  }

  let count = 0
  for (const row of data.data) {
    const exDateRaw = row[0]?.trim()
    const code = row[1]?.trim()
    const name = row[2]?.trim() ?? ''
    const amount = parseDividend(row[5])
    const type = row[6]?.trim() ?? '息'

    if (!code || !exDateRaw) continue
    const exDate = twRocToIso(exDateRaw)
    if (!exDate) continue

    const cash = (type === '息' || type === '權息') ? amount : 0
    const stock = (type === '權' || type === '權息') ? amount : 0

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
    } catch (e) {
      console.error('[dividend-sync] insert error:', code, e.message)
    }
  }

  console.log(`[dividend-sync] upserted ${count} records`)
  return count
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
