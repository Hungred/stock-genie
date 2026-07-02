import axios from 'axios'

const FUGLE_API_KEY = process.env.FUGLE_API_KEY

function isMarketOpen() {
  const now = new Date()
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000) // UTC+8
  const day = tw.getUTCDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  const mins = tw.getUTCHours() * 60 + tw.getUTCMinutes()
  return mins >= 9 * 60 && mins < 13 * 60 + 30
}

async function fetchQuote(code) {
  const symbol = code.toUpperCase()
  const url = `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${symbol}`
  const { data } = await axios.get(url, {
    headers: { 'X-API-KEY': FUGLE_API_KEY },
  })
  return data
}

function resolvePrice(data) {
  if (isMarketOpen()) {
    return data.lastPrice || data.closePrice || null
  }
  return data.closePrice || data.lastPrice || null
}

export async function getStockPrice(code) {
  try {
    const data = await fetchQuote(code)
    return resolvePrice(data)
  } catch {
    return null
  }
}

export async function getStockInfo(code) {
  try {
    const data = await fetchQuote(code)
    return {
      name: data.name ?? null,
      price: resolvePrice(data),
    }
  } catch {
    return { name: null, price: null }
  }
}

export async function getFullQuote(code) {
  try {
    const data = await fetchQuote(code)
    const price = resolvePrice(data)
    const prevClose = data.previousClose ?? data.referencePrice ?? null
    const change = price != null && prevClose != null ? price - prevClose : null
    const changePercent = change != null && prevClose ? (change / prevClose) * 100 : null
    const volumeLots = data.volume != null ? Math.round(data.volume / 1000) : null
    // 股價更新時間：台灣時間 HH:MM
    const now = new Date()
    const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const updatedAt = `${String(twTime.getUTCHours()).padStart(2, '0')}:${String(twTime.getUTCMinutes()).padStart(2, '0')}`

    return {
      name: data.name ?? null,
      price,
      prevClose,
      change,
      changePercent,
      open: data.openPrice ?? null,
      high: data.highPrice ?? null,
      low: data.lowPrice ?? null,
      volumeLots,
      isOpen: isMarketOpen(),
      updatedAt,
    }
  } catch {
    return null
  }
}

export async function getIntradayCandles(code) {
  try {
    // Yahoo Finance 免費分鐘 K 線（不需 API key）
    const symbol = `${code.toUpperCase()}.TW`
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d&includePrePost=false`
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const result = data?.chart?.result?.[0]
    if (!result) return []
    const timestamps = result.timestamp ?? []
    const q = result.indicators?.quote?.[0] ?? {}
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString(),
        open: q.open?.[i],
        high: q.high?.[i],
        low: q.low?.[i],
        close: q.close?.[i],
        volume: q.volume?.[i],
      }))
      .filter(c => c.close != null)
  } catch (e) {
    console.error('[candles] yahoo error:', e.message)
    return []
  }
}

async function fetchYahooCandles(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`
  const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const result = data?.chart?.result?.[0]
  if (!result) return []
  const timestamps = result.timestamp ?? []
  const q = result.indicators?.quote?.[0] ?? {}
  return timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
    }))
    .filter(c => c.open != null && c.close != null)
}

export async function getDailyCandles(code) {
  const upper = code.toUpperCase()
  // 先試 .TW（上市），失敗再試 .TWO（上櫃）
  for (const suffix of ['.TW', '.TWO']) {
    try {
      const candles = await fetchYahooCandles(`${upper}${suffix}`)
      if (candles.length) return candles
    } catch {}
  }
  return []
}

export async function getMultiplePrices(codes) {
  const results = {}
  await Promise.all(
    codes.map(async (code) => {
      results[code] = await getStockPrice(code)
    })
  )
  return results
}
