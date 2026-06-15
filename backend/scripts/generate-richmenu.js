import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const W = 2500
const H = 843
const COL = Math.floor(W / 3)

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .label { font-family: 'PingFang TC', 'Noto Sans TC', sans-serif; font-weight: bold; }
      .sub   { font-family: 'PingFang TC', 'Noto Sans TC', sans-serif; font-weight: normal; }
    </style>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="#1a2238"/>

  <!-- 分隔線 -->
  <line x1="${COL}" y1="60" x2="${COL}" y2="${H - 60}" stroke="#ffffff22" stroke-width="2"/>
  <line x1="${COL * 2}" y1="60" x2="${COL * 2}" y2="${H - 60}" stroke="#ffffff22" stroke-width="2"/>

  <!-- 第一格：損益 -->
  <rect x="20" y="20" width="${COL - 40}" height="${H - 40}" rx="24" fill="#ffffff0d"/>
  <text x="${COL * 0.5}" y="340" text-anchor="middle" font-size="180" fill="#f59e0b">📊</text>
  <text x="${COL * 0.5}" y="530" text-anchor="middle" font-size="110" fill="#ffffff" class="label">損益查詢</text>
  <text x="${COL * 0.5}" y="640" text-anchor="middle" font-size="72" fill="#94a3b8" class="sub">查看今日損益</text>

  <!-- 第二格：持股 -->
  <rect x="${COL + 20}" y="20" width="${COL - 40}" height="${H - 40}" rx="24" fill="#ffffff0d"/>
  <text x="${COL * 1.5}" y="340" text-anchor="middle" font-size="180" fill="#60a5fa">📋</text>
  <text x="${COL * 1.5}" y="530" text-anchor="middle" font-size="110" fill="#ffffff" class="label">持股明細</text>
  <text x="${COL * 1.5}" y="640" text-anchor="middle" font-size="72" fill="#94a3b8" class="sub">查看持股清單</text>

  <!-- 第三格：開啟網頁 -->
  <rect x="${COL * 2 + 20}" y="20" width="${COL - 40}" height="${H - 40}" rx="24" fill="#3b82f620"/>
  <text x="${COL * 2.5}" y="340" text-anchor="middle" font-size="180" fill="#818cf8">🖥️</text>
  <text x="${COL * 2.5}" y="530" text-anchor="middle" font-size="110" fill="#ffffff" class="label">開啟網頁</text>
  <text x="${COL * 2.5}" y="640" text-anchor="middle" font-size="72" fill="#94a3b8" class="sub">完整功能操作</text>
</svg>
`

const outputPath = join(__dirname, '../richmenu.png')

await sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)

console.log(`✅ Rich Menu 圖片已產生：${outputPath}`)
console.log(`   尺寸：${W} x ${H} px`)
