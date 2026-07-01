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
    }
  } catch {
    return null
  }
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
