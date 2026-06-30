import sharp from 'sharp'

export async function generateRichMenuImage() {
  const panels = [
    { color: '#FF6B35', icon: '📊', label: '損益查詢', sub: '今日損益' },
    { color: '#3B82F6', icon: '📋', label: '持股明細', sub: '持股清單' },
    { color: '#06C755', icon: '👤', label: '我的帳號', sub: '綁定 / 登入' },
    { color: '#8B5CF6', icon: '🌐', label: '開啟網頁', sub: '完整功能' },
  ]

  const pw = 625
  const h = 843

  const rects = panels.map((p, i) => `
    <rect x="${i * pw}" y="0" width="${pw}" height="${h}" fill="${p.color}"/>
    ${i > 0 ? `<line x1="${i * pw}" y1="0" x2="${i * pw}" y2="${h}" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>` : ''}
    <text x="${i * pw + pw / 2}" y="360" text-anchor="middle" dominant-baseline="middle"
      fill="white" font-size="70" font-weight="bold" font-family="'Noto Sans TC', 'PingFang TC', sans-serif">${p.label}</text>
    <text x="${i * pw + pw / 2}" y="470" text-anchor="middle" dominant-baseline="middle"
      fill="rgba(255,255,255,0.75)" font-size="44" font-family="'Noto Sans TC', 'PingFang TC', sans-serif">${p.sub}</text>
  `).join('')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="2500" height="${h}" xmlns="http://www.w3.org/2000/svg">
  ${rects}
</svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}
