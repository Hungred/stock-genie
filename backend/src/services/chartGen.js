import * as echarts from 'echarts'
import sharp from 'sharp'

async function svgToPng(svgStr, width, height) {
  return sharp(Buffer.from(svgStr)).resize(width, height).png().toBuffer()
}

export async function generatePieChart(holdings) {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 500 })

  chart.setOption({
    backgroundColor: '#ffffff',
    title: { text: '持股市值佔比', left: 'center', top: 16, textStyle: { fontSize: 18, color: '#1f2937' } },
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}\n現值：${p.value.toLocaleString()} 元\n佔比：${p.percent}%`,
    },
    legend: {
      orient: 'vertical',
      right: 16,
      top: 'middle',
      textStyle: { fontSize: 12, color: '#4b5563' },
    },
    series: [{
      type: 'pie',
      radius: ['38%', '65%'],
      center: ['38%', '55%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: holdings
        .filter(h => h.current_value)
        .map(h => ({ name: `${h.code} ${h.name}`, value: Math.round(h.current_value) })),
    }],
  })

  const svg = chart.renderToSVGString()
  chart.dispose()
  return svgToPng(svg, 800, 500)
}

export async function generateBarChart(holdings) {
  const sorted = [...holdings]
    .filter(h => h.pnl !== null)
    .sort((a, b) => b.pnl - a.pnl)

  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 500 })

  chart.setOption({
    backgroundColor: '#ffffff',
    title: { text: '各股損益（元）', left: 'center', top: 16, textStyle: { fontSize: 18, color: '#1f2937' } },
    tooltip: {
      trigger: 'axis',
      formatter: (p) => `${p[0].name}\n損益：${p[0].value >= 0 ? '+' : ''}${p[0].value.toLocaleString()} 元`,
    },
    grid: { left: 60, right: 24, top: 60, bottom: 50 },
    xAxis: {
      type: 'category',
      data: sorted.map(h => h.code),
      axisLabel: { fontSize: 12, color: '#6b7280' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 11,
        color: '#6b7280',
        formatter: (v) => v >= 0 ? `+${(v / 1000).toFixed(0)}K` : `${(v / 1000).toFixed(0)}K`,
      },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 48,
      data: sorted.map(h => ({
        value: Math.round(h.pnl),
        itemStyle: { color: h.pnl >= 0 ? '#ef4444' : '#22c55e', borderRadius: [4, 4, 0, 0] },
      })),
    }],
  })

  const svg = chart.renderToSVGString()
  chart.dispose()
  return svgToPng(svg, 800, 500)
}
