<script setup>
import { ref, onMounted, watch } from 'vue'
import { useWatchlistStore } from '../stores/watchlist'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const store = useWatchlistStore()

const activeTab = ref('holdings')
const stocks = ref([])
const loadingStocks = ref(false)
const addQuery = ref('')
const searchResults = ref([])    // [{ code, name }]
const searchError = ref('')
const searching = ref(false)
const addingStock = ref(false)
const newListName = ref('')
const creatingList = ref(false)
const showNewList = ref(false)

onMounted(async () => {
  await store.fetchLists()
  await loadTab(activeTab.value)
})

watch(activeTab, (val) => loadTab(val))

async function loadTab(tab) {
  loadingStocks.value = true
  try {
    if (tab === 'holdings') {
      stocks.value = await store.fetchHoldings()
    } else {
      stocks.value = await store.fetchStocks(tab)
    }
  } catch (e) {
    ElMessage.error('載入失敗')
  } finally {
    loadingStocks.value = false
  }
}

async function handleSearch() {
  const q = addQuery.value.trim()
  if (!q) return
  searching.value = true
  searchResults.value = []
  searchError.value = ''
  try {
    const { data } = await axios.get(`${API}/api/stock/search?q=${encodeURIComponent(q)}`)
    searchResults.value = data
  } catch (e) {
    searchError.value = e.response?.data?.error || '找不到相關股票'
  } finally {
    searching.value = false
  }
}

async function handleAddStock(stock) {
  if (!stock) return
  if (activeTab.value === 'holdings') return ElMessage.warning('我的持股為自動計算，無法手動新增')
  addingStock.value = true
  try {
    await store.addStock(activeTab.value, stock.code, stock.name)
    addQuery.value = ''
    searchResults.value = []
    searchError.value = ''
    await loadTab(activeTab.value)
    await store.fetchLists()
    ElMessage.success(`${stock.code} ${stock.name} 已加入清單`)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '新增失敗')
  } finally {
    addingStock.value = false
  }
}

function clearSearch() {
  addQuery.value = ''
  searchResults.value = []
  searchError.value = ''
}

async function handleRemoveStock(code) {
  if (activeTab.value === 'holdings') return
  try {
    await ElMessageBox.confirm(`確認移除 ${code}？`, '移除股票', {
      confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning',
    })
    await store.removeStock(activeTab.value, code)
    stocks.value = stocks.value.filter(s => s.code !== code)
    await store.fetchLists()
    ElMessage.success('已移除')
  } catch {}
}

async function handleCreateList() {
  if (!newListName.value.trim()) return
  creatingList.value = true
  try {
    const list = await store.createList(newListName.value.trim())
    newListName.value = ''
    showNewList.value = false
    activeTab.value = list.id
    ElMessage.success(`清單「${list.name}」已建立`)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '建立失敗')
  } finally {
    creatingList.value = false
  }
}

async function handleDeleteList(list) {
  try {
    await ElMessageBox.confirm(`確認刪除清單「${list.name}」？`, '刪除清單', {
      confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning',
    })
    await store.deleteList(list.id)
    if (activeTab.value === list.id) {
      activeTab.value = 'holdings'
    }
    ElMessage.success('已刪除')
  } catch (e) {
    if (e?.response?.data?.error) ElMessage.error(e.response.data.error)
  }
}

function priceChangeColor(change) {
  if (change == null) return 'text-gray-500'
  return change >= 0 ? 'text-red-500' : 'text-green-500'
}

function formatChange(item) {
  if (item.change != null) {
    const sign = item.change >= 0 ? '+' : ''
    return `${sign}${item.change.toFixed(2)}`
  }
  if (item.pnl != null) {
    const sign = item.pnl >= 0 ? '+' : ''
    return `${sign}${item.pnl.toFixed(0)}`
  }
  return '-'
}

function formatChangePct(item) {
  const pct = item.changePercent ?? item.pnlPercent ?? null
  if (pct == null) return ''
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4 md:mb-6">
      <h1 class="text-xl md:text-2xl font-bold text-gray-800">自選清單</h1>
      <el-button size="small" @click="showNewList = !showNewList">
        <el-icon class="mr-1"><Plus /></el-icon>新增清單
      </el-button>
    </div>

    <!-- 新增清單輸入 -->
    <div v-if="showNewList" class="bg-white rounded-xl p-3 mb-4 shadow-sm border border-gray-100 flex gap-2">
      <el-input v-model="newListName" placeholder="清單名稱" size="small" class="flex-1" @keyup.enter="handleCreateList" />
      <el-button type="primary" size="small" :loading="creatingList" @click="handleCreateList">建立</el-button>
      <el-button size="small" @click="showNewList = false; newListName = ''">取消</el-button>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="flex overflow-x-auto border-b border-gray-100">
        <!-- 我的持股 tab -->
        <button
          @click="activeTab = 'holdings'"
          class="flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'holdings'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          📋 我的持股
        </button>

        <!-- 自選清單 tabs -->
        <div
          v-for="list in store.lists"
          :key="list.id"
          class="flex-shrink-0 flex items-center group"
        >
          <button
            @click="activeTab = list.id"
            class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === list.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            ⭐ {{ list.name }}
            <span class="text-xs text-gray-400 ml-1">({{ list.stock_count }})</span>
          </button>
          <button
            v-if="list.name !== '我的最愛'"
            @click.stop="handleDeleteList(list)"
            class="hidden group-hover:flex items-center text-gray-300 hover:text-red-400 pr-1"
          >
            <el-icon class="text-xs"><Close /></el-icon>
          </button>
        </div>
      </div>

      <!-- 新增股票欄（持股 tab 隱藏） -->
      <div v-if="activeTab !== 'holdings'" class="p-3 border-b border-gray-100 space-y-2">
        <div class="flex gap-2">
          <el-input
            v-model="addQuery"
            placeholder="輸入代號或名稱（如 0050、台積電）"
            size="small"
            class="max-w-xs"
            clearable
            @clear="clearSearch"
          />
          <el-button size="small" :loading="searching" @click="handleSearch">查詢</el-button>
        </div>
        <!-- 查詢結果清單 -->
        <div v-if="searchResults.length" class="border border-gray-200 rounded-lg overflow-hidden">
          <div
            v-for="stock in searchResults"
            :key="stock.code"
            class="flex items-center gap-3 px-3 py-2 bg-white hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
          >
            <span class="font-semibold text-gray-800 text-sm w-16 flex-shrink-0">{{ stock.code }}</span>
            <span class="text-gray-600 text-sm flex-1">{{ stock.name }}</span>
            <el-button type="primary" size="small" :loading="addingStock" @click="handleAddStock(stock)">加入</el-button>
          </div>
        </div>
        <div v-if="searchError" class="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-500">
          <el-icon><CircleClose /></el-icon>{{ searchError }}
        </div>
      </div>

      <!-- 股票列表 桌機 -->
      <div class="hidden md:block overflow-x-auto">
        <el-table :data="stocks" v-loading="loadingStocks" stripe>
          <el-table-column prop="code" label="代號" width="90" />
          <el-table-column prop="name" label="名稱" min-width="120" />
          <el-table-column label="現價" width="100" align="right">
            <template #default="{ row }">
              {{ row.price ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column label="漲跌" width="100" align="right">
            <template #default="{ row }">
              <span :class="priceChangeColor(row.change ?? row.pnl)">
                {{ formatChange(row) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="漲跌%" width="100" align="right">
            <template #default="{ row }">
              <span :class="priceChangeColor(row.change ?? row.pnl)">
                {{ formatChangePct(row) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column v-if="activeTab !== 'holdings'" width="60" align="center">
            <template #default="{ row }">
              <el-button type="danger" link size="small" @click="handleRemoveStock(row.code)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 股票列表 手機 -->
      <div class="md:hidden divide-y divide-gray-100" v-loading="loadingStocks">
        <div
          v-for="row in stocks"
          :key="row.code"
          class="flex items-center justify-between px-4 py-3"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-800 text-sm">{{ row.code }}</span>
              <span class="text-gray-500 text-xs">{{ row.name }}</span>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">
              <span v-if="row.shares">{{ row.shares }}股</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div class="font-semibold text-sm text-gray-800">{{ row.price ?? '-' }}</div>
              <div class="text-xs" :class="priceChangeColor(row.change ?? row.pnl)">
                {{ formatChange(row) }} {{ formatChangePct(row) }}
              </div>
            </div>
            <el-button
              v-if="activeTab !== 'holdings'"
              type="danger" link size="small"
              @click="handleRemoveStock(row.code)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-if="!stocks.length && !loadingStocks" class="py-8 text-center text-gray-400 text-sm">
          {{ activeTab === 'holdings' ? '尚無持股資料' : '清單是空的，輸入代號新增股票' }}
        </div>
      </div>
    </div>
  </div>
</template>
