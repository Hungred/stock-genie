<script setup>
import { onMounted, computed, ref } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DatasetComponent,
} from 'echarts/components'

use([CanvasRenderer, PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, DatasetComponent])

const store = usePortfolioStore()
const { holdings, loading } = storeToRefs(store)

const activeChart = ref('pie')

onMounted(() => store.fetchHoldings())

const pieOption = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: {
    trigger: 'item',
    formatter: (p) => `${p.name}<br/>現值：${p.value.toLocaleString()} 元<br/>佔比：${p.percent}%`,
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center',
    textStyle: { fontSize: 12, color: '#4b5563' },
    formatter: (name) => {
      const h = holdings.value.find(x => x.name === name)
      return h ? `${h.code} ${name}` : name
    },
  },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['38%', '50%'],
    avoidLabelOverlap: true,
    label: { show: false },
    emphasis: {
      label: { show: true, fontSize: 14, fontWeight: 'bold' },
      itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
    },
    data: holdings.value
      .filter(h => h.current_value)
      .map(h => ({ name: h.name, value: Math.round(h.current_value) })),
  }],
}))

const barOption = computed(() => {
  const sorted = [...holdings.value]
    .filter(h => h.pnl !== null)
    .sort((a, b) => b.pnl - a.pnl)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        return `${p.name}<br/>損益：${p.value >= 0 ? '+' : ''}${p.value.toLocaleString()} 元`
      },
    },
    grid: { left: 16, right: 24, top: 16, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: sorted.map(h => h.code),
      axisLabel: { fontSize: 11, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
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
  }
})
</script>

<template>
  <div>
    <h1 class="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">持股明細</h1>

    <!-- 圖表區 -->
    <div v-if="holdings.length" class="mb-4 md:mb-6">

      <!-- 桌機：左右並列 -->
      <div class="hidden md:grid grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 class="text-sm font-semibold text-gray-600 mb-2">市值佔比</h2>
          <VChart :option="pieOption" style="height: 260px" autoresize />
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 class="text-sm font-semibold text-gray-600 mb-2">各股損益（元）</h2>
          <VChart :option="barOption" style="height: 260px" autoresize />
        </div>
      </div>

      <!-- 手機：tab 切換 -->
      <div class="md:hidden bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 class="text-sm font-semibold text-gray-600">
            {{ activeChart === 'pie' ? '市值佔比' : '各股損益（元）' }}
          </h2>
          <div class="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              @click="activeChart = 'pie'"
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              :class="activeChart === 'pie' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'"
            >圓餅圖</button>
            <button
              @click="activeChart = 'bar'"
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              :class="activeChart === 'bar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'"
            >長條圖</button>
          </div>
        </div>
        <VChart
          :option="activeChart === 'pie' ? pieOption : barOption"
          style="height: 260px; padding: 0 8px 8px"
          autoresize
        />
      </div>

    </div>

    <!-- 持股列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">

      <!-- 桌機 Table -->
      <div class="hidden md:block overflow-x-auto">
        <el-table :data="holdings" v-loading="loading" stripe>
          <el-table-column prop="code" label="代號" width="90" />
          <el-table-column prop="name" label="名稱" min-width="130" />
          <el-table-column prop="category" label="類型" width="100" />
          <el-table-column prop="shares" label="持有股數" width="100" align="right" />
          <el-table-column prop="avg_cost" label="平均成本" width="110" align="right">
            <template #default="{ row }">{{ row.avg_cost?.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="total_cost" label="總成本" width="120" align="right">
            <template #default="{ row }">{{ row.total_cost?.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="current_price" label="現價" width="100" align="right">
            <template #default="{ row }">{{ row.current_price?.toFixed(2) ?? '-' }}</template>
          </el-table-column>
          <el-table-column prop="current_value" label="現值" width="120" align="right">
            <template #default="{ row }">{{ row.current_value?.toLocaleString() ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="損益" width="120" align="right">
            <template #default="{ row }">
              <span :class="row.pnl >= 0 ? 'text-red-500 font-medium' : 'text-green-500 font-medium'">
                {{ row.pnl >= 0 ? '+' : '' }}{{ row.pnl?.toFixed(0) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="報酬率" width="100" align="right">
            <template #default="{ row }">
              <el-tag :type="row.pnl_percent >= 0 ? 'danger' : 'success'" size="small">
                {{ row.pnl_percent >= 0 ? '+' : '' }}{{ row.pnl_percent?.toFixed(2) }}%
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 手機卡片列表 -->
      <div class="md:hidden divide-y divide-gray-100" v-loading="loading">
        <div v-for="row in holdings" :key="row.code" class="px-4 py-3">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <span class="font-bold text-gray-800">{{ row.code }}</span>
              <span class="text-gray-600 text-sm">{{ row.name }}</span>
              <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
            </div>
            <el-tag :type="row.pnl_percent >= 0 ? 'danger' : 'success'" size="small">
              {{ row.pnl_percent >= 0 ? '+' : '' }}{{ row.pnl_percent?.toFixed(2) }}%
            </el-tag>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs text-gray-500">
            <div>
              <span class="text-gray-400">股數</span>
              <div class="font-medium text-gray-700">{{ row.shares }}</div>
            </div>
            <div>
              <span class="text-gray-400">均成本</span>
              <div class="font-medium text-gray-700">{{ row.avg_cost?.toFixed(2) }}</div>
            </div>
            <div>
              <span class="text-gray-400">現價</span>
              <div class="font-medium text-gray-700">{{ row.current_price?.toFixed(2) ?? '-' }}</div>
            </div>
            <div>
              <span class="text-gray-400">總成本</span>
              <div class="font-medium text-gray-700">{{ row.total_cost?.toLocaleString() }}</div>
            </div>
            <div>
              <span class="text-gray-400">現值</span>
              <div class="font-medium text-gray-700">{{ row.current_value?.toLocaleString() ?? '-' }}</div>
            </div>
            <div>
              <span class="text-gray-400">損益</span>
              <div class="font-medium" :class="row.pnl >= 0 ? 'text-red-500' : 'text-green-500'">
                {{ row.pnl >= 0 ? '+' : '' }}{{ row.pnl?.toFixed(0) }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="!holdings.length && !loading" class="py-8 text-center text-gray-400 text-sm">
          尚無持股資料
        </div>
      </div>

    </div>
  </div>
</template>
