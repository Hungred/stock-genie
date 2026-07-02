import { Router } from 'express'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authMiddleware } from '../middleware/auth.js'
import db from '../db/index.js'
import { getStockInfo } from '../services/stockPrice.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// 辨識截圖，回傳持股清單（待確認）
router.post('/analyze', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳圖片' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY 未設定' })

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' })

    const base64 = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype || 'image/jpeg'

    const result = await model.generateContent([
      {
        inlineData: { mimeType, data: base64 }
      },
      `這是一張券商持股截圖。請提取所有股票持倉資訊，以 JSON 陣列格式回傳，每筆包含：
- code：股票代號（純數字，4-6位，如 0050、2330）
- name：股票名稱（中文）
- shares：持有股數（整數）
- price：成交均價或每股成本（數字，取自「成交均價」或「平均成本」欄位）

只回傳 JSON 陣列，不要其他說明或 markdown。範例：
[{"code":"0050","name":"元大台灣50","shares":225,"price":53.16}]`
    ])

    const text = result.response.text().trim()
    // 移除可能的 markdown code block
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const stocks = JSON.parse(cleaned)

    if (!Array.isArray(stocks)) throw new Error('回傳格式錯誤')

    res.json(stocks.filter(s => s.code && s.shares > 0))
  } catch (e) {
    console.error('[import/analyze]', e.message)
    res.status(500).json({ error: `辨識失敗：${e.message}` })
  }
})

// 確認後批次匯入交易
router.post('/confirm', authMiddleware, async (req, res) => {
  const { stocks, date } = req.body
  if (!Array.isArray(stocks) || !stocks.length) return res.status(400).json({ error: '無資料' })

  const txDate = date || new Date().toLocaleDateString('sv-SE')
  const results = []

  for (const s of stocks) {
    const { code, name, shares, price } = s
    if (!code || !shares || !price) continue
    try {
      // 名稱若空則從 Fugle 查
      let stockName = name?.trim() || ''
      if (!stockName) {
        const info = await getStockInfo(code)
        stockName = info.name || code
      }
      await db.query(
        'INSERT INTO transactions (user_id, date, code, name, type, shares, price, fee) VALUES ($1,$2,$3,$4,$5,$6,$7,0)',
        [req.user.userId, txDate, code.toUpperCase(), stockName, 'buy', parseInt(shares), parseFloat(price)]
      )
      results.push({ code, name: stockName, ok: true })
    } catch (e) {
      results.push({ code, ok: false, error: e.message })
    }
  }

  res.json({ ok: true, results })
})

export default router
