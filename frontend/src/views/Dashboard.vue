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
    <h1 class="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">總資產總覽</h1>

    <!-- 總覽卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-8">
      <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <p class="text-xs md:text-sm text-gray-500 mb-1">總成本</p>
        <p class="text-lg md:text-xl font-bold text-gray-800 truncate">{{ formatMoney(totalCost) }}</p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <p class="text-xs md:text-sm text-gray-500 mb-1">現值</p>
        <p class="text-lg md:text-xl font-bold text-gray-800 truncate">{{ formatMoney(totalValue) }}</p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <p class="text-xs md:text-sm text-gray-500 mb-1">損益</p>
        <p class="text-lg md:text-xl font-bold truncate" :class="pnlClass">
          {{ totalPnl >= 0 ? '+' : '-' }}{{ formatMoney(totalPnl) }}
        </p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <p class="text-xs md:text-sm text-gray-500 mb-1">報酬率</p>
        <p class="text-lg md:text-xl font-bold" :class="pnlClass">
          {{ totalPnl >= 0 ? '+' : '' }}{{ totalPnlPercent }}%
        </p>
        <p class="text-xs text-gray-400">整體</p>
      </div>
    </div>

    <!-- 持股列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-3 md:p-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-700">持股狀況</h2>
      </div>

      <!-- 桌機 Table -->
      <div class="hidden md:block overflow-x-auto">
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

      <!-- 手機卡片列表 -->
      <div class="md:hidden divide-y divide-gray-100" v-loading="loading">
        <div
          v-for="row in holdings"
          :key="row.code"
          class="flex items-center justify-between px-4 py-3"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-800 text-sm">{{ row.code }}</span>
              <span class="text-gray-500 text-xs">{{ row.name }}</span>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">
              {{ row.shares }}股 · 均{{ row.avg_cost?.toFixed(2) }} · 現{{ row.current_price?.toFixed(2) ?? '-' }}
            </div>
          </div>
          <div class="text-right">
            <div class="font-bold text-sm" :class="row.pnl >= 0 ? 'text-red-500' : 'text-green-500'">
              {{ row.pnl >= 0 ? '+' : '' }}{{ row.pnl?.toFixed(0) }}
            </div>
            <div class="text-xs" :class="row.pnl_percent >= 0 ? 'text-red-500' : 'text-green-500'">
              {{ row.pnl_percent >= 0 ? '+' : '' }}{{ row.pnl_percent?.toFixed(2) }}%
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
