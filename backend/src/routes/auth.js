import { Router } from 'express'
import axios from 'axios'
import db from '../db/index.js'
import { signToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

async function findOrCreateUser(lineUserId, displayName) {
  const { rows } = await db.query('SELECT * FROM users WHERE line_user_id = $1', [lineUserId])
  if (rows.length) return rows[0]
  const result = await db.query(
    'INSERT INTO users (line_user_id, display_name) VALUES ($1, $2) ON CONFLICT (line_user_id) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING *',
    [lineUserId, displayName || '']
  )
  return result.rows[0]
}

// LIFF：前端傳 LINE ID Token → 後端驗證 → 建帳號 → 發 JWT
router.post('/liff', async (req, res) => {
  const { idToken } = req.body
  if (!idToken) return res.status(400).json({ error: '缺少 idToken' })
  try {
    const { data } = await axios.post('https://api.line.me/oauth2/v2.1/verify', null, {
      params: { id_token: idToken, client_id: process.env.LINE_LOGIN_CHANNEL_ID },
    })
    const user = await findOrCreateUser(data.sub, data.name)
    res.json({ token: signToken({ userId: user.id, lineUserId: data.sub }) })
  } catch (e) {
    res.status(401).json({ error: '驗證失敗：' + e.message })
  }
})

// LINE Login（網頁）：前端拿到 code → 後端換 token → 建帳號 → 發 JWT
router.post('/line', async (req, res) => {
  const { code, redirectUri } = req.body
  if (!code) return res.status(400).json({ error: '缺少 code' })
  try {
    const { data: tokenData } = await axios.post(
      'https://api.line.me/oauth2/v2.1/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    const { data: profile } = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const user = await findOrCreateUser(profile.userId, profile.displayName)
    res.json({ token: signToken({ userId: user.id, lineUserId: profile.userId }), displayName: user.display_name })
  } catch (e) {
    res.status(401).json({ error: '登入失敗：' + e.message })
  }
})

// 取得目前登入的使用者資訊
router.get('/me', authMiddleware, async (req, res) => {
  const { rows } = await db.query('SELECT id, display_name, created_at FROM users WHERE id = $1', [req.user.userId])
  if (!rows.length) return res.status(404).json({ error: '找不到使用者' })
  res.json(rows[0])
})

export default router
