import axios from 'axios'

const FUGLE_API_KEY = process.env.FUGLE_API_KEY

// 台股即時/收盤行情
export async function getStockPrice(code) {
  try {
    // 判斷是 ETF 或個股，Fugle 代號格式
    const symbol = code.toUpperCase()
    const url = `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${symbol}`
    const { data } = await axios.get(url, {
      headers: { 'X-API-KEY': FUGLE_API_KEY },
    })
    return data.closePrice ?? data.lastPrice ?? null
  } catch {
    return null
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
