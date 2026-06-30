import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-in-env'

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token
  if (!token) return res.status(401).json({ error: '未登入' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' })
  }
}

export function signToken(payload, expiresIn = '90d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}
