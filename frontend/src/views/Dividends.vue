<script setup>
import { onMounted, computed } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'

const store = usePortfolioStore()
const { holdings, dividends, loading } = storeToRefs(store)

onMounted(async () => {
  await store.fetchHoldings()
  await store.fetchDividends()
})

const totalDividend = computed(() =>
  dividends.value.reduce((sum, d) => sum + d.amount, 0)
)

const currentMonth = new Date().getMonth() + 1
const upcomingDividends = computed(() =>
  holdings.value.filter(h => {
    if (!h.dividend_months) return false
    return h.dividend_months.includes(currentMonth) || h.dividend_months.includes(currentMonth + 1)
  })
)
</script>

<template>
  <div>
    <h1 class="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">配息記錄</h1>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
      <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <p class="text-xs md:text-sm text-gray-500 mb-1">累計領取配息</p>
        <p class="text-xl md:text-2xl font-bold text-blue-600">{{ totalDividend.toLocaleString() }}</p>
        <p class="text-xs text-gray-400">元</p>
      </div>
      <div class="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <p class="text-xs md:text-sm text-gray-500 mb-1">近期配息提醒</p>
        <p class="text-xl md:text-2xl font-bold text-orange-500">{{ upcomingDividends.length }}</p>
        <p class="text-xs text-gray-400">支股票本月/下月配息</p>
      </div>
    </div>

    <!-- 近期配息提醒 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 md:mb-6" v-if="upcomingDividends.length">
      <div class="p-3 md:p-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-700">近期配息提醒</h2>
      </div>
      <div class="p-3 md:p-4 flex flex-wrap gap-2 md:gap-3">
        <div
          v-for="h in upcomingDividends"
          :key="h.code"
          class="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2"
        >
          <span class="font-medium text-gray-700 text-sm">{{ h.code }}</span>
          <span class="text-xs text-gray-500">{{ h.name }}</span>
          <el-tag type="warning" size="small">{{ h.dividend_frequency }}</el-tag>
        </div>
      </div>
    </div>

    <!-- 配息歷史 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-700">配息歷史</h2>
        <el-button size="small" type="primary">新增配息記錄</el-button>
      </div>

      <!-- 桌機 Table -->
      <div class="hidden md:block overflow-x-auto">
        <el-table :data="dividends" v-loading="loading" stripe>
          <el-table-column prop="date" label="配息日期" width="120" />
          <el-table-column prop="code" label="代號" width="90" />
          <el-table-column prop="name" label="名稱" min-width="130" />
          <el-table-column prop="dividend_per_share" label="每股配息" width="110" align="right">
            <template #default="{ row }">{{ row.dividend_per_share?.toFixed(3) }}</template>
          </el-table-column>
          <el-table-column prop="shares" label="持有股數" width="100" align="right" />
          <el-table-column prop="amount" label="實領金額" width="120" align="right">
            <template #default="{ row }">
              <span class="text-blue-600 font-medium">{{ row.amount?.toLocaleString() }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 手機卡片列表 -->
      <div class="md:hidden divide-y divide-gray-100" v-loading="loading">
        <div
          v-for="row in dividends"
          :key="row.id"
          class="flex items-center justify-between px-4 py-3"
        >
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-semibold text-gray-800 text-sm">{{ row.code }}</span>
              <span class="text-gray-500 text-xs">{{ row.name }}</span>
            </div>
            <div class="text-xs text-gray-400">
              {{ row.date }} · {{ row.shares }}股 × {{ row.dividend_per_share?.toFixed(3) }}
            </div>
          </div>
          <div class="text-blue-600 font-bold text-sm">
            +{{ row.amount?.toLocaleString() }}
          </div>
        </div>
        <div v-if="!dividends.length && !loading" class="py-8 text-center text-gray-400 text-sm">
          尚無配息記錄
        </div>
      </div>

    </div>
  </div>
</template>
