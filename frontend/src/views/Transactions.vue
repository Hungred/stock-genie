<script setup>
import { ref, onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const store = usePortfolioStore()
const { transactions, loading } = storeToRefs(store)

const showDialog = ref(false)
const submitting = ref(false)

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
      <el-button type="primary" @click="showDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon>新增交易
      </el-button>
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
        </el-table>
      </div>

      <!-- 手機卡片列表 -->
      <div class="md:hidden divide-y divide-gray-100" v-loading="loading">
        <div v-for="row in transactions" :key="row.id" class="flex items-center justify-between px-4 py-3">
          <div>
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
          <div class="text-right font-medium text-gray-700 text-sm">{{ totalAmount(row) }}</div>
        </div>
        <div v-if="!transactions.length && !loading" class="py-8 text-center text-gray-400 text-sm">
          尚無交易記錄
        </div>
      </div>

    </div>

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
