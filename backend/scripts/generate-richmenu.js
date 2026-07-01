import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const W = 2500
const H = 1686
const pw = Math.floor(W / 3)   // 833
const ph = Math.floor(H / 2)   // 843

const panels = [
  { color: '#FF6B35', emoji: '📊', label: '損益查詢', sub: '查看今日損益', row: 0, col: 0 },
  { color: '#3B82F6', emoji: '📋', label: '持股明細', sub: '查看持股清單', row: 0, col: 1 },
  { color: '#06C755', emoji: '⭐', label: '自選清單', sub: '關注股票追蹤', row: 0, col: 2 },
  { color: '#7C3AED', emoji: '👤', label: '我的帳號', sub: '綁定 / 登入',   row: 1, col: 0 },
  { color: '#0EA5E9', emoji: '🖥️', label: '開啟網頁', sub: '完整功能操作', row: 1, col: 1 },
  { color: '#F59E0B', emoji: '📌', label: '指令說明', sub: '查看所有指令', row: 1, col: 2 },
]

const svgPanels = panels.map(p => {
  const x = p.col * pw
  const y = p.row * ph
  const cx = x + pw / 2
  const cy = y + ph / 2
  const dividers = []
  if (p.col > 0) dividers.push(`<line x1="${x}" y1="${y + 30}" x2="${x}" y2="${y + ph - 30}" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>`)
  if (p.row > 0) dividers.push(`<line x1="${x + 30}" y1="${y}" x2="${x + pw - 30}" y2="${y}" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>`)
  return `
  <rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${p.color}"/>
  ${dividers.join('')}
  <text x="${cx}" y="${cy - 120}"
    text-anchor="middle" dominant-baseline="middle"
    font-size="160" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${p.emoji}</text>
  <text x="${cx}" y="${cy + 60}"
    text-anchor="middle" dominant-baseline="middle"
    fill="white" font-size="82" font-weight="bold"
    font-family="PingFang TC, Noto Sans TC, sans-serif">${p.label}</text>
  <text x="${cx}" y="${cy + 180}"
    text-anchor="middle" dominant-baseline="middle"
    fill="rgba(255,255,255,0.75)" font-size="54"
    font-family="PingFang TC, Noto Sans TC, sans-serif">${p.sub}</text>
`}).join('')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${svgPanels}
</svg>`

const outputPath = join(__dirname, '../richmenu.png')
await sharp(Buffer.from(svg)).png().toFile(outputPath)
console.log(`✅ Rich Menu 圖片已產生：${outputPath}（${W} x ${H} px）`)
