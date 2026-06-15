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
    <h1 class="text-2xl font-bold text-gray-800 mb-6">持股明細</h1>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
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
          <template #default="{ row }">
            <span>{{ row.current_price?.toFixed(2) ?? '-' }}</span>
          </template>
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
  </div>
</template>
