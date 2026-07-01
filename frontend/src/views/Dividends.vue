<script setup>
import { onMounted, computed, ref } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const store = usePortfolioStore()
const { dividends, holdings, loading } = storeToRefs(store)

const upcoming = ref([])

// ── 提醒設定 ────────────────────────────────────────────────────
const showNotify = ref(false)
const notifySettings = ref({ globalEnabled: true, globalDays: 1, perStock: {} })
const savingNotify = ref(false)

function stockEnabled(code) {
  const s = notifySettings.value.perStock[code]
  return s?.enabled === false ? false : true
}
function stockDays(code) {
  return notifySettings.value.perStock[code]?.remind_days_before ?? null
}

async function saveGlobal() {
  savingNotify.value = true
  try {
    await axios.put(`${API}/api/dividends/notify-settings`, {
      scope: 'ALL',
      enabled: notifySettings.value.globalEnabled,
      remind_days_before: notifySettings.value.globalDays,
    })
    ElMessage.success('已儲存')
  } catch { ElMessage.error('儲存失敗') }
  finally { savingNotify.value = false }
}

async function saveStock(code, enabled, days) {
  const perStock = notifySettings.value.perStock
  if (!perStock[code]) perStock[code] = {}
  if (enabled !== undefined) perStock[code].enabled = enabled
  if (days !== undefined) perStock[code].remind_days_before = days

  savingNotify.value = true
  try {
    await axios.put(`${API}/api/dividends/notify-settings`, {
      scope: code,
      enabled: perStock[code].enabled ?? null,
      remind_days_before: perStock[code].remind_days_before ?? null,
    })
    ElMessage.success('已儲存')
  } catch { ElMessage.error('儲存失敗') }
  finally { savingNotify.value = false }
}

// ── 掛載 ──────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    store.fetchDividends(),
    store.fetchHoldings(),
  ])
  try {
    const [upcomingRes, notifyRes] = await Promise.all([
      axios.get(`${API}/api/dividends/upcoming`),
      axios.get(`${API}/api/dividends/notify-settings`),
    ])
    upcoming.value = upcomingRes.data
    notifySettings.value = notifyRes.data
  } catch {}
})

const totalDividend = computed(() =>
  dividends.value.reduce((sum, d) => sum + d.amount, 0)
)

// ── 新增配息 ─────────────────────────────────────────────────
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

// ── 刪除配息 ─────────────────────────────────────────────────
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`確認刪除 ${row.date} ${row.code} 配息？`, '刪除確認', {
      confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning',
    })
    await store.deleteDividend(row.id)
    ElMessage.success('已刪除')
  } catch {}
}

// ── 編輯配息（auto 記錄）────────────────────────────────────
const editDialog = ref(false)
const editRow = ref(null)
const editSubmitting = ref(false)

function openEdit(row) {
  editRow.value = { ...row }
  editDialog.value = true
}

async function handleEdit() {
  editSubmitting.value = true
  try {
    await axios.put(`${API}/api/dividends/${editRow.value.id}`, {
      date: editRow.value.date,
      dividend_per_share: editRow.value.dividend_per_share,
      shares: editRow.value.shares,
      amount: editRow.value.amount,
    })
    await store.fetchDividends()
    editDialog.value = false
    ElMessage.success('已更新')
  } catch { ElMessage.error('更新失敗') }
  finally { editSubmitting.value = false }
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
        <p class="text-xs md:text-sm text-gray-500 mb-1">近期除息</p>
        <p class="text-xl md:text-2xl font-bold text-orange-500">{{ upcoming.length }}</p>
        <p class="text-xs text-gray-400">支股票 30 天內除息</p>
      </div>
    </div>

    <!-- 近期除息清單 -->
    <div v-if="upcoming.length" class="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 md:mb-6">
      <div class="p-3 md:p-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-700">📅 近期除息（未來 30 天）</h2>
      </div>
      <div class="divide-y divide-gray-50">
        <div v-for="r in upcoming" :key="r.code + r.ex_date" class="flex items-center justify-between px-4 py-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm text-gray-800">{{ r.code }}</span>
              <span class="text-xs text-gray-500">{{ r.name }}</span>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">除息日：{{ r.ex_date?.slice(0,10) }}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-medium text-gray-700">每股 {{ r.dividend_cash }} 元</div>
            <div class="text-xs text-orange-500 font-medium">預計領 {{ r.estimated_amount?.toLocaleString() }} 元</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提醒設定 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 md:mb-6">
      <div
        class="p-3 md:p-4 flex items-center justify-between cursor-pointer select-none"
        :class="showNotify ? 'border-b border-gray-100' : ''"
        @click="showNotify = !showNotify"
      >
        <h2 class="font-semibold text-gray-700">⚙️ 配息提醒設定</h2>
        <el-icon class="text-gray-400 transition-transform duration-200" :style="showNotify ? 'transform:rotate(180deg)' : ''">
          <ArrowDown />
        </el-icon>
      </div>

      <div v-if="showNotify" class="p-4 space-y-5">

        <!-- 全域開關 -->
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-800">全域提醒</div>
            <div class="text-xs text-gray-400 mt-0.5">關閉後所有配息提醒都不會發送</div>
          </div>
          <el-switch v-model="notifySettings.globalEnabled" @change="saveGlobal" />
        </div>

        <!-- 預設提前天數 -->
        <div v-if="notifySettings.globalEnabled" class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-800">預設提前天數</div>
            <div class="text-xs text-gray-400 mt-0.5">除息日前幾天發送提醒（無個股設定時適用）</div>
          </div>
          <div class="flex items-center gap-1.5">
            <el-input-number
              v-model="notifySettings.globalDays"
              :min="1" :max="30" size="small"
              style="width: 90px"
              @change="saveGlobal"
            />
            <span class="text-sm text-gray-500">天</span>
          </div>
        </div>

        <!-- 個股設定 -->
        <div v-if="notifySettings.globalEnabled && holdings.length">
          <div class="text-sm font-medium text-gray-700 mb-3">個股設定</div>
          <div class="space-y-1">
            <div
              v-for="h in holdings" :key="h.code"
              class="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-medium text-sm text-gray-800">{{ h.code }}</span>
                <span class="text-xs text-gray-500 truncate">{{ h.name }}</span>
                <el-tag v-if="!stockEnabled(h.code)" type="info" size="small">已停用</el-tag>
              </div>
              <div class="flex items-center gap-3 flex-shrink-0 ml-2">
                <div class="flex items-center gap-1" v-if="stockEnabled(h.code)">
                  <span class="text-xs text-gray-400">提前</span>
                  <el-input-number
                    :model-value="stockDays(h.code)"
                    :min="1" :max="30" size="small"
                    :placeholder="String(notifySettings.globalDays)"
                    style="width: 75px"
                    @change="(v) => saveStock(h.code, undefined, v)"
                  />
                  <span class="text-xs text-gray-400">天</span>
                </div>
                <el-switch
                  :model-value="stockEnabled(h.code)"
                  size="small"
                  @change="(v) => saveStock(h.code, v, undefined)"
                />
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-3">個股未設定天數時，沿用全域預設（{{ notifySettings.globalDays }} 天）</p>
        </div>

        <div v-if="notifySettings.globalEnabled && !holdings.length" class="text-sm text-gray-400 text-center py-2">
          尚無持股，新增交易記錄後可設定個股提醒
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
          <el-table-column prop="name" label="名稱" min-width="120" />
          <el-table-column label="每股配息" width="110" align="right">
            <template #default="{ row }">{{ Number(row.dividend_per_share)?.toFixed(3) }}</template>
          </el-table-column>
          <el-table-column prop="shares" label="股數" width="90" align="right" />
          <el-table-column label="實領金額" width="120" align="right">
            <template #default="{ row }">
              <span class="text-blue-600 font-medium">{{ row.amount?.toLocaleString() }}</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.source === 'auto'" type="warning" size="small" class="mr-1">自動</el-tag>
              <el-button v-if="row.source === 'auto'" type="primary" link size="small" @click="openEdit(row)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button v-else type="danger" link size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 手機卡片列表 -->
      <div class="md:hidden divide-y divide-gray-100" v-loading="loading">
        <div v-for="row in dividends" :key="row.id" class="flex items-center justify-between px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="font-semibold text-gray-800 text-sm">{{ row.code }}</span>
              <span class="text-gray-500 text-xs">{{ row.name }}</span>
              <el-tag v-if="row.source === 'auto'" type="warning" size="small">自動建立，請確認</el-tag>
            </div>
            <div class="text-xs text-gray-400">
              {{ row.date }} · {{ row.shares }}股 × {{ Number(row.dividend_per_share)?.toFixed(3) }}
            </div>
          </div>
          <div class="flex items-center gap-2 ml-2">
            <div class="text-blue-600 font-bold text-sm">+{{ row.amount?.toLocaleString() }}</div>
            <el-button v-if="row.source === 'auto'" type="primary" link size="small" @click="openEdit(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button v-else type="danger" link size="small" @click="handleDelete(row)">
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
              <el-input v-model="row.name" placeholder="自動帶入" size="small" />
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">每股配息 *</div>
              <el-input-number v-model="row.dividend_per_share" :precision="4" :min="0" size="small" class="w-full" />
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">股數 *</div>
              <el-input-number v-model="row.shares" :min="1" size="small" class="w-full" />
            </div>
            <div class="col-span-2" v-if="row.dividend_per_share && row.shares">
              <span class="text-sm text-gray-500">實領金額：<span class="font-medium text-blue-600">{{ (row.dividend_per_share * row.shares).toFixed(0) }} 元</span></span>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <el-button size="small" @click="addRow" class="w-full">
          <el-icon class="mr-1"><Plus /></el-icon>再新增一筆
        </el-button>
      </div>
      <template #footer>
        <el-button @click="showDialog = false; rows = [emptyRow()]">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">確認新增（{{ rows.length }} 筆）</el-button>
      </template>
    </el-dialog>

    <!-- 編輯配息 Dialog（auto 記錄） -->
    <el-dialog v-model="editDialog" title="確認配息金額" :width="'96vw'" style="max-width: 480px">
      <div v-if="editRow" class="space-y-3">
        <el-alert type="warning" :closable="false" title="此記錄由系統自動建立，請確認金額是否正確" />
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div class="text-xs text-gray-500 mb-1">日期</div>
            <el-date-picker v-model="editRow.date" type="date" value-format="YYYY-MM-DD" class="w-full" size="small" />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1">每股配息</div>
            <el-input-number v-model="editRow.dividend_per_share" :precision="4" :min="0" size="small" class="w-full"
              @change="editRow.amount = parseFloat((editRow.dividend_per_share * editRow.shares).toFixed(0))" />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1">股數</div>
            <el-input-number v-model="editRow.shares" :min="1" size="small" class="w-full"
              @change="editRow.amount = parseFloat((editRow.dividend_per_share * editRow.shares).toFixed(0))" />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1">實領金額</div>
            <el-input-number v-model="editRow.amount" :min="0" size="small" class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEdit">確認儲存</el-button>
      </template>
    </el-dialog>

  </div>
</template>
