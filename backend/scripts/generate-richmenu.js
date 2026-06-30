import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const W = 2500
const H = 843
const pw = W / 4  // 625 per panel

const panels = [
  { color: '#FF6B35', emoji: '📊', label: '損益查詢', sub: '查看今日損益' },
  { color: '#3B82F6', emoji: '📋', label: '持股明細', sub: '查看持股清單' },
  { color: '#06C755', emoji: '👤', label: '我的帳號', sub: '綁定 / 登入' },
  { color: '#7C3AED', emoji: '🖥️', label: '開啟網頁', sub: '完整功能操作' },
]

const svgPanels = panels.map((p, i) => `
  <rect x="${i * pw}" y="0" width="${pw}" height="${H}" fill="${p.color}"/>
  ${i > 0 ? `<line x1="${i * pw}" y1="40" x2="${i * pw}" y2="${H - 40}" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>` : ''}
  <text x="${i * pw + pw / 2}" y="300"
    text-anchor="middle" dominant-baseline="middle"
    font-size="180" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${p.emoji}</text>
  <text x="${i * pw + pw / 2}" y="510"
    text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="90" font-weight="bold"
    font-family="PingFang TC, Noto Sans TC, sans-serif">${p.label}</text>
  <text x="${i * pw + pw / 2}" y="640"
    text-anchor="middle" dominant-baseline="middle"
    fill="rgba(255,255,255,0.75)" font-size="58"
    font-family="PingFang TC, Noto Sans TC, sans-serif">${p.sub}</text>
`).join('')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${svgPanels}
</svg>`

const outputPath = join(__dirname, '../richmenu.png')
await sharp(Buffer.from(svg)).png().toFile(outputPath)
console.log(`✅ Rich Menu 圖片已產生：${outputPath}（${W} x ${H} px）`)
