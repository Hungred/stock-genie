import axios from 'axios'

const FUGLE_API_KEY = process.env.FUGLE_API_KEY

async function fetchQuote(code) {
  const symbol = code.toUpperCase()
  const url = `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${symbol}`
  const { data } = await axios.get(url, {
    headers: { 'X-API-KEY': FUGLE_API_KEY },
  })
  return data
}

// 取得股票現價
export async function getStockPrice(code) {
  try {
    const data = await fetchQuote(code)
    return data.closePrice ?? data.lastPrice ?? null
  } catch {
    return null
  }
}

// 取得股票名稱
export async function getStockName(code) {
  try {
    const data = await fetchQuote(code)
    return data.name ?? null
  } catch {
    return null
  }
}

// 取得股票名稱 + 現價
export async function getStockInfo(code) {
  try {
    const data = await fetchQuote(code)
    return {
      name: data.name ?? null,
      price: data.closePrice ?? data.lastPrice ?? null,
    }
  } catch {
    return { name: null, price: null }
  }
}

// 批次取得多支股票價格
export async function getMultiplePrices(codes) {
  const results = {}
  await Promise.all(
    codes.map(async (code) => {
      results[code] = await getStockPrice(code)
    })
  )
  return results
}
