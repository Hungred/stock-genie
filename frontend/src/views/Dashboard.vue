<script setup>
import { onMounted, computed } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'

const store = usePortfolioStore()
const { holdings, loading, totalCost, totalValue, totalPnl, totalPnlPercent } = storeToRefs(store)

onMounted(() => store.fetchHoldings())

const pnlClass = computed(() =>
  totalPnl.value >= 0 ? 'text-red-500' : 'text-green-500'
)

function formatMoney(val) {
  return Math.abs(val).toLocaleString('zh-TW', { minimumFractionDigits: 0 })
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-800 mb-6">總資產總覽</h1>

    <!-- 總覽卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">總成本</p>
        <p class="text-xl font-bold text-gray-800">{{ formatMoney(totalCost) }}</p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">現值</p>
        <p class="text-xl font-bold text-gray-800">{{ formatMoney(totalValue) }}</p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">損益</p>
        <p class="text-xl font-bold" :class="pnlClass">
          {{ totalPnl >= 0 ? '+' : '-' }}{{ formatMoney(totalPnl) }}
        </p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">報酬率</p>
        <p class="text-xl font-bold" :class="pnlClass">
          {{ totalPnl >= 0 ? '+' : '' }}{{ totalPnlPercent }}%
        </p>
        <p class="text-xs text-gray-400">整體</p>
      </div>
    </div>

    <!-- 持股列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-700">持股狀況</h2>
      </div>
      <el-table :data="holdings" v-loading="loading" stripe>
        <el-table-column prop="code" label="代號" width="90" />
        <el-table-column prop="name" label="名稱" min-width="120" />
        <el-table-column prop="shares" label="股數" width="80" align="right" />
        <el-table-column prop="avg_cost" label="均成本" width="100" align="right">
          <template #default="{ row }">{{ row.avg_cost?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="current_price" label="現價" width="100" align="right">
          <template #default="{ row }">{{ row.current_price?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="損益" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.pnl >= 0 ? 'text-red-500' : 'text-green-500'">
              {{ row.pnl >= 0 ? '+' : '' }}{{ row.pnl?.toFixed(0) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="報酬率" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.pnl_percent >= 0 ? 'text-red-500' : 'text-green-500'">
              {{ row.pnl_percent >= 0 ? '+' : '' }}{{ row.pnl_percent?.toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
