import * as echarts from 'echarts'
import sharp from 'sharp'

export async function generateKlineChart(candles, prevClose) {
  const W = 800, H = 360

  const times = candles.map(c => {
    const t = new Date(c.date)
    const h = String(t.getUTCHours() + 8).padStart(2, '0')
    const m = String(t.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  })
  const prices = candles.map(c => c.close)
  const lastPrice = prices[prices.length - 1] ?? prevClose
  const lineColor = lastPrice != null && prevClose != null && lastPrice >= prevClose ? '#e03131' : '#2f9e44'
  const areaColor = lastPrice != null && prevClose != null && lastPrice >= prevClose
    ? 'rgba(224,49,49,0.12)' : 'rgba(47,158,68,0.12)'

  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: W, height: H })
  chart.setOption({
    backgroundColor: '#ffffff',
    grid: { left: 52, right: 16, top: 16, bottom: 36 },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisLabel: {
        fontSize: 11, color: '#9ca3af',
        interval: Math.floor(times.length / 4),
      },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 11, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: [
      // 昨收參考線
      ...(prevClose != null ? [{
        type: 'line', markLine: {
          silent: true, symbol: 'none',
          data: [{ yAxis: prevClose }],
          lineStyle: { type: 'dashed', color: '#9ca3af', width: 1 },
          label: { formatter: `${prevClose}`, color: '#9ca3af', fontSize: 10 },
        },
        data: [], z: 0,
      }] : []),
      // 價格折線 + 面積
      {
        type: 'line',
        data: prices,
        showSymbol: false,
        lineStyle: { color: lineColor, width: 2 },
        areaStyle: { color: areaColor },
        z: 1,
      },
    ],
  })

  const svg = chart.renderToSVGString()
  chart.dispose()
  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer()
}

async function svgToPng(svgStr, width, height) {
  return sharp(Buffer.from(svgStr)).resize(width, height).png().toBuffer()
}

const COLORS = [
  '#5470c6','#91cc75','#fac858','#ee6666','#73c0de',
  '#3ba272','#fc8452','#9a60b4','#ea7ccc','#60a5fa',
]

export async function generatePieChart(holdings) {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 480 })

  const data = holdings
    .filter(h => h.current_value)
    .map((h, i) => ({
      name: h.code,
      value: Math.round(h.current_value),
      itemStyle: { color: COLORS[i % COLORS.length] },
    }))

  chart.setOption({
    backgroundColor: '#ffffff',
    tooltip: { show: false },
    legend: {
      orient: 'vertical',
      right: 16,
      top: 'middle',
      textStyle: { fontSize: 13, color: '#4b5563' },
      // legend 只顯示代號（ASCII，無亂碼）
      data: data.map(d => d.name),
    },
    series: [{
      type: 'pie',
      radius: ['38%', '65%'],
      center: ['38%', '52%'],
      avoidLabelOverlap: true,
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        fontSize: 12,
        color: '#374151',
      },
      labelLine: { show: true },
      data,
    }],
  })

  const svg = chart.renderToSVGString()
  chart.dispose()
  return svgToPng(svg, 800, 480)
}

export async function generateBarChart(holdings) {
  const sorted = [...holdings]
    .filter(h => h.pnl !== null)
    .sort((a, b) => b.pnl - a.pnl)

  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 480 })

  chart.setOption({
    backgroundColor: '#ffffff',
    tooltip: { show: false },
    grid: { left: 70, right: 24, top: 40, bottom: 50 },
    xAxis: {
      type: 'category',
      data: sorted.map(h => h.code),
      axisLabel: { fontSize: 13, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 12,
        color: '#6b7280',
        formatter: (v) => v >= 0 ? `+${(v / 1000).toFixed(0)}K` : `${(v / 1000).toFixed(0)}K`,
      },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 52,
      label: {
        show: true,
        position: (params) => params.value >= 0 ? 'top' : 'bottom',
        formatter: (p) => p.value >= 0 ? `+${(p.value / 1000).toFixed(1)}K` : `${(p.value / 1000).toFixed(1)}K`,
        fontSize: 11,
        color: '#374151',
      },
      data: sorted.map(h => ({
        value: Math.round(h.pnl),
        itemStyle: { color: h.pnl >= 0 ? '#ef4444' : '#22c55e', borderRadius: [4, 4, 0, 0] },
      })),
    }],
  })

  const svg = chart.renderToSVGString()
  chart.dispose()
  return svgToPng(svg, 800, 480)
}
