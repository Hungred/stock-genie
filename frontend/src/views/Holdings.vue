<script setup>
import { onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'

const store = usePortfolioStore()
const { holdings, loading } = storeToRefs(store)

onMounted(() => store.fetchHoldings())
</script>

<template>
  <div>
    <h1 class="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">持股明細</h1>

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
        <div
          v-for="row in holdings"
          :key="row.code"
          class="px-4 py-3"
        >
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
