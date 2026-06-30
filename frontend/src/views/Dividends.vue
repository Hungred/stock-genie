<script setup>
import { onMounted, computed, ref } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

// 新增配息
const showDialog = ref(false)
const submitting = ref(false)

function emptyRow() {
  return { date: new Date().toISOString().slice(0, 10), code: '', name: '', dividend_per_share: null, shares: null, lookingUp: false }
}
const rows = ref([emptyRow()])

function addRow() { rows.value.push(emptyRow()) }
function removeRow(i) { rows.value.splice(i, 1) }

async function onCodeBlur(row) {
  const code = row.code.trim()
  if (!code || row.name) return
  row.lookingUp = true
  try {
    const { data } = await axios.get(`${API}/api/stock/${code}`)
    if (data.name) row.name = data.name
    const holding = holdings.value.find(h => h.code === code.toUpperCase())
    if (holding && !row.shares) row.shares = holding.shares
  } catch {} finally { row.lookingUp = false }
}

async function handleSubmit() {
  const valid = rows.value.every(r => r.code && r.dividend_per_share && r.shares)
  if (!valid) return ElMessage.warning('請確認每筆資料的代號、每股配息、股數都已填寫')
  submitting.value = true
  try {
    await Promise.all(rows.value.map(r => store.addDividend({
      ...r,
      amount: parseFloat((r.dividend_per_share * r.shares).toFixed(0)),
    })))
    ElMessage.success(`成功新增 ${rows.value.length} 筆配息記錄`)
    showDialog.value = false
    rows.value = [emptyRow()]
  } catch { ElMessage.error('新增失敗，請稍後再試') }
  finally { submitting.value = false }
}

// 刪除配息
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`確認刪除 ${row.date} ${row.code} 配息 ${row.amount?.toLocaleString()} 元？`, '刪除確認', {
      confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning',
    })
    await store.deleteDividend(row.id)
    ElMessage.success('已刪除')
  } catch {}
}
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
        <el-button size="small" type="primary" @click="showDialog = true">
          <el-icon class="mr-1"><Plus /></el-icon>新增配息記錄
        </el-button>
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
          <el-table-column width="60" align="center">
            <template #default="{ row }">
              <el-button type="danger" link size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
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
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-semibold text-gray-800 text-sm">{{ row.code }}</span>
              <span class="text-gray-500 text-xs">{{ row.name }}</span>
            </div>
            <div class="text-xs text-gray-400">
              {{ row.date }} · {{ row.shares }}股 × {{ row.dividend_per_share?.toFixed(3) }}
            </div>
          </div>
          <div class="flex items-center gap-2 ml-2">
            <div class="text-blue-600 font-bold text-sm">+{{ row.amount?.toLocaleString() }}</div>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-if="!dividends.length && !loading" class="py-8 text-center text-gray-400 text-sm">
          尚無配息記錄
        </div>
      </div>

    </div>

    <!-- 新增配息 Dialog -->
    <el-dialog v-model="showDialog" title="新增配息記錄" :width="'96vw'" style="max-width: 640px">
      <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div v-for="(row, i) in rows" :key="i" class="border border-gray-200 rounded-xl p-3 relative">
          <button v-if="rows.length > 1" @click="removeRow(i)" class="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition-colors">
            <el-icon><Close /></el-icon>
          </button>
          <div class="text-xs font-medium text-gray-400 mb-2">第 {{ i + 1 }} 筆</div>
          <div class="grid grid-cols-2 gap-2">
            <div class="col-span-2 sm:col-span-1">
              <div class="text-xs text-gray-500 mb-1">日期</div>
              <el-date-picker v-model="row.date" type="date" value-format="YYYY-MM-DD" class="w-full" size="small" />
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">股票代號 *</div>
              <el-input v-model="row.code" placeholder="如：0050" size="small" @blur="onCodeBlur(row)" />
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">股票名稱</div>
              <el-input v-model="row.name" placeholder="自動帶入" size="small" :loading="row.lookingUp" />
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">每股配息 *</div>
              <el-input-number v-model="row.dividend_per_share" :precision="4" :min="0" size="small" class="w-full" />
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">股數 *</div>
              <el-input-number v-model="row.shares" :min="1" size="small" class="w-full" />
            </div>
            <div class="col-span-2 flex items-center" v-if="row.dividend_per_share && row.shares">
              <span class="text-sm text-gray-500">實領金額：<span class="font-medium text-blue-600">{{ (row.dividend_per_share * row.shares).toFixed(0) }} 元</span></span>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <el-button size="small" @click="addRow" class="w-full" dashed>
          <el-icon class="mr-1"><Plus /></el-icon>再新增一筆
        </el-button>
      </div>
      <template #footer>
        <el-button @click="showDialog = false; rows = [emptyRow()]">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          確認新增（{{ rows.length }} 筆）
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>
