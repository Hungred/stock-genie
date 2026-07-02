<script setup>
import { ref, onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const store = usePortfolioStore()
const { transactions, loading } = storeToRefs(store)

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`確認刪除 ${row.date} ${row.code} ${row.type === 'buy' ? '買入' : '賣出'} ${row.shares} 股？`, '刪除確認', {
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.deleteTransaction(row.id)
    ElMessage.success('已刪除')
  } catch {
    // 取消
  }
}

const showDialog = ref(false)
const submitting = ref(false)

// 截圖匯入
const showImportDialog = ref(false)
const importFile = ref(null)
const importPreview = ref('')
const analyzing = ref(false)
const importStocks = ref([])
const importDate = ref(new Date().toISOString().slice(0, 10))
const importing = ref(false)

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  importFile.value = file
  importPreview.value = URL.createObjectURL(file)
  importStocks.value = []
}

async function handleAnalyze() {
  if (!importFile.value) return ElMessage.warning('請先選擇圖片')
  analyzing.value = true
  importStocks.value = []
  try {
    const form = new FormData()
    form.append('image', importFile.value)
    const { data } = await axios.post(`${API}/api/import/analyze`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (!data.length) return ElMessage.warning('未辨識到持股資料，請確認圖片是否清晰')
    importStocks.value = data
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '辨識失敗，請再試一次')
  } finally {
    analyzing.value = false
  }
}

async function handleImportConfirm() {
  if (!importStocks.value.length) return
  importing.value = true
  try {
    const { data } = await axios.post(`${API}/api/import/confirm`, {
      stocks: importStocks.value,
      date: importDate.value,
    })
    const ok = data.results.filter(r => r.ok).length
    ElMessage.success(`成功匯入 ${ok} 筆持股`)
    showImportDialog.value = false
    importFile.value = null
    importPreview.value = ''
    importStocks.value = []
    store.fetchTransactions()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '匯入失敗')
  } finally {
    importing.value = false
  }
}

function resetImport() {
  importFile.value = null
  importPreview.value = ''
  importStocks.value = []
}

function emptyRow() {
  return {
    date: new Date().toISOString().slice(0, 10),
    code: '',
    name: '',
    type: 'buy',
    shares: null,
    price: null,
    fee: null,
    lookingUp: false,
  }
}

const rows = ref([emptyRow()])

function addRow() {
  rows.value.push(emptyRow())
}

function removeRow(i) {
  rows.value.splice(i, 1)
}

async function onCodeBlur(row) {
  const code = row.code.trim()
  if (!code || row.name) return
  row.lookingUp = true
  try {
    const { data } = await axios.get(`${API}/api/stock/${code}`)
    if (data.name) row.name = data.name
  } catch {
    // 查不到讓使用者自己填
  } finally {
    row.lookingUp = false
  }
}

async function handleSubmit() {
  const valid = rows.value.every(r => r.code && r.shares && r.price)
  if (!valid) return ElMessage.warning('請確認每筆資料的代號、股數、單價都已填寫')

  submitting.value = true
  try {
    await Promise.all(rows.value.map(r => store.addTransaction(r)))
    ElMessage.success(`成功新增 ${rows.value.length} 筆交易記錄`)
    showDialog.value = false
    rows.value = [emptyRow()]
    store.fetchTransactions()
  } catch {
    ElMessage.error('新增失敗，請稍後再試')
  } finally {
    submitting.value = false
  }
}

function totalAmount(row) {
  return (row.shares * row.price + (row.fee || 0)).toLocaleString()
}

onMounted(() => store.fetchTransactions())
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4 md:mb-6">
      <h1 class="text-xl md:text-2xl font-bold text-gray-800">交易記錄</h1>
      <div class="flex gap-2">
        <el-button @click="showImportDialog = true; resetImport()">
          📷 截圖匯入
        </el-button>
        <el-button type="primary" @click="showDialog = true">
          <el-icon class="mr-1"><Plus /></el-icon>新增交易
        </el-button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100">

      <!-- 桌機 Table -->
      <div class="hidden md:block overflow-x-auto">
        <el-table :data="transactions" v-loading="loading" stripe>
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="code" label="代號" width="90" />
          <el-table-column prop="name" label="名稱" min-width="120" />
          <el-table-column prop="type" label="類型" width="70">
            <template #default="{ row }">
              <el-tag :type="row.type === 'buy' ? 'danger' : 'success'" size="small">
                {{ row.type === 'buy' ? '買入' : '賣出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="shares" label="股數" width="80" align="right" />
          <el-table-column prop="price" label="單價" width="90" align="right" />
          <el-table-column label="手續費" width="80" align="right">
            <template #default="{ row }">{{ row.fee || 0 }}</template>
          </el-table-column>
          <el-table-column label="總金額" width="110" align="right">
            <template #default="{ row }">{{ totalAmount(row) }}</template>
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
        <div v-for="row in transactions" :key="row.id" class="flex items-center justify-between px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <el-tag :type="row.type === 'buy' ? 'danger' : 'success'" size="small">
                {{ row.type === 'buy' ? '買入' : '賣出' }}
              </el-tag>
              <span class="font-semibold text-gray-800 text-sm">{{ row.code }}</span>
              <span class="text-gray-500 text-xs">{{ row.name }}</span>
            </div>
            <div class="text-xs text-gray-400">
              {{ row.date }} · {{ row.shares }}股 × {{ row.price }}
              <span v-if="row.fee"> · 手續費 {{ row.fee }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 ml-2">
            <div class="font-medium text-gray-700 text-sm">{{ totalAmount(row) }}</div>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-if="!transactions.length && !loading" class="py-8 text-center text-gray-400 text-sm">
          尚無交易記錄
        </div>
      </div>

    </div>

    <!-- 截圖匯入 Dialog -->
    <el-dialog v-model="showImportDialog" title="📷 截圖匯入持股" :width="'96vw'" style="max-width: 640px" @close="resetImport">

      <!-- 上傳區 -->
      <div class="space-y-4">
        <div
          class="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
          @click="$refs.fileInput.click()"
        >
          <div v-if="!importPreview">
            <div class="text-3xl mb-2">📷</div>
            <div class="text-sm text-gray-500">點擊上傳券商持股截圖</div>
            <div class="text-xs text-gray-400 mt-1">支援 JPG、PNG</div>
          </div>
          <img v-else :src="importPreview" class="max-h-48 mx-auto rounded-lg object-contain" />
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />

        <el-button
          v-if="importFile && !importStocks.length"
          type="primary" class="w-full" :loading="analyzing"
          @click="handleAnalyze"
        >
          {{ analyzing ? 'AI 辨識中...' : '開始辨識' }}
        </el-button>

        <!-- 辨識結果 -->
        <div v-if="importStocks.length">
          <div class="text-sm font-medium text-gray-700 mb-2">辨識結果（可修改後匯入）</div>

          <div class="mb-3">
            <div class="text-xs text-gray-500 mb-1">買入日期</div>
            <el-date-picker v-model="importDate" type="date" value-format="YYYY-MM-DD" size="small" />
          </div>

          <div class="border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs text-gray-500">代號</th>
                  <th class="px-3 py-2 text-left text-xs text-gray-500">名稱</th>
                  <th class="px-3 py-2 text-right text-xs text-gray-500">股數</th>
                  <th class="px-3 py-2 text-right text-xs text-gray-500">均價</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(s, i) in importStocks" :key="i">
                  <td class="px-3 py-2">
                    <el-input v-model="s.code" size="small" class="w-20" />
                  </td>
                  <td class="px-3 py-2">
                    <el-input v-model="s.name" size="small" />
                  </td>
                  <td class="px-3 py-2">
                    <el-input-number v-model="s.shares" :min="1" size="small" class="w-24" />
                  </td>
                  <td class="px-3 py-2">
                    <el-input-number v-model="s.price" :precision="2" :min="0" size="small" class="w-24" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button v-if="importStocks.length" type="primary" :loading="importing" @click="handleImportConfirm">
          匯入 {{ importStocks.length }} 筆
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增交易 Dialog -->
    <el-dialog v-model="showDialog" title="新增交易記錄" :width="'96vw'" style="max-width: 720px">

      <!-- 多筆列表 -->
      <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div
          v-for="(row, i) in rows"
          :key="i"
          class="border border-gray-200 rounded-xl p-3 relative"
        >
          <!-- 移除按鈕 -->
          <button
            v-if="rows.length > 1"
            @click="removeRow(i)"
            class="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <el-icon><Close /></el-icon>
          </button>

          <div class="text-xs font-medium text-gray-400 mb-2">第 {{ i + 1 }} 筆</div>

          <div class="grid grid-cols-2 gap-2">
            <!-- 日期 -->
            <div class="col-span-2 sm:col-span-1">
              <div class="text-xs text-gray-500 mb-1">日期</div>
              <el-date-picker v-model="row.date" type="date" value-format="YYYY-MM-DD" class="w-full" size="small" />
            </div>

            <!-- 類型 -->
            <div class="col-span-2 sm:col-span-1">
              <div class="text-xs text-gray-500 mb-1">類型</div>
              <el-radio-group v-model="row.type" size="small">
                <el-radio-button value="buy">買入</el-radio-button>
                <el-radio-button value="sell">賣出</el-radio-button>
              </el-radio-group>
            </div>

            <!-- 代號 -->
            <div>
              <div class="text-xs text-gray-500 mb-1">股票代號 *</div>
              <el-input v-model="row.code" placeholder="如：0050" size="small" @blur="onCodeBlur(row)" />
            </div>

            <!-- 名稱 -->
            <div>
              <div class="text-xs text-gray-500 mb-1">股票名稱</div>
              <el-input v-model="row.name" placeholder="自動帶入" size="small" :loading="row.lookingUp" />
            </div>

            <!-- 股數 -->
            <div>
              <div class="text-xs text-gray-500 mb-1">股數 *</div>
              <el-input-number v-model="row.shares" :min="1" size="small" class="w-full" />
            </div>

            <!-- 單價 -->
            <div>
              <div class="text-xs text-gray-500 mb-1">單價 *</div>
              <el-input-number v-model="row.price" :precision="2" :min="0" size="small" class="w-full" />
            </div>

            <!-- 手續費 -->
            <div>
              <div class="text-xs text-gray-500 mb-1">手續費</div>
              <el-input-number v-model="row.fee" :min="0" size="small" class="w-full" placeholder="選填" />
            </div>

            <!-- 預估總額 -->
            <div class="flex items-end">
              <div v-if="row.shares && row.price" class="text-sm text-gray-500">
                總計：<span class="font-medium text-gray-700">
                  {{ ((row.shares * row.price) + (row.fee || 0)).toLocaleString() }} 元
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增一筆按鈕 -->
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
