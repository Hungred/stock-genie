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

const form = ref({
  date: new Date().toISOString().slice(0, 10),
  code: '',
  name: '',
  type: 'buy',
  shares: null,
  price: null,
  fee: null,
})

const rules = {
  date: [{ required: true, message: '請選擇日期' }],
  code: [{ required: true, message: '請輸入股票代號' }],
  shares: [{ required: true, message: '請輸入股數' }],
  price: [{ required: true, message: '請輸入單價' }],
}

const formRef = ref()
const lookingUpName = ref(false)

onMounted(() => store.fetchTransactions())

async function onCodeBlur() {
  const code = form.value.code.trim()
  if (!code || form.value.name) return
  lookingUpName.value = true
  try {
    const { data } = await axios.get(`${API}/api/stock/${code}`)
    if (data.name) form.value.name = data.name
  } catch {
    // 查不到就讓使用者自己填
  } finally {
    lookingUpName.value = false
  }
}

async function handleSubmit() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      await store.addTransaction(form.value)
      ElMessage.success('交易記錄新增成功')
      showDialog.value = false
      resetForm()
      store.fetchTransactions()
    } catch (e) {
      ElMessage.error('新增失敗，請稍後再試')
    } finally {
      submitting.value = false
    }
  })
}

function resetForm() {
  form.value = {
    date: new Date().toISOString().slice(0, 10),
    code: '', name: '', type: 'buy',
    shares: null, price: null, fee: null,
  }
}

function totalAmount(row) {
  return (row.shares * row.price + (row.fee || 0)).toLocaleString()
}
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
        <div
          v-for="row in transactions"
          :key="row.id"
          class="flex items-center justify-between px-4 py-3"
        >
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
          <div class="text-right font-medium text-gray-700 text-sm">
            {{ totalAmount(row) }}
          </div>
        </div>
        <div v-if="!transactions.length && !loading" class="py-8 text-center text-gray-400 text-sm">
          尚無交易記錄
        </div>
      </div>

    </div>

    <!-- 新增交易 Dialog -->
    <el-dialog
      v-model="showDialog"
      title="新增交易記錄"
      :width="'92vw'"
      style="max-width: 480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="日期" prop="date">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" class="w-full" />
        </el-form-item>
        <el-form-item label="股票代號" prop="code">
          <el-input v-model="form.code" placeholder="如：0050" @blur="onCodeBlur" />
        </el-form-item>
        <el-form-item label="股票名稱">
          <el-input v-model="form.name" placeholder="輸入代號後自動帶入" :loading="lookingUpName" />
        </el-form-item>
        <el-form-item label="類型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="buy">買入</el-radio>
            <el-radio value="sell">賣出</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="股數" prop="shares">
          <el-input-number v-model="form.shares" :min="1" class="w-full" />
        </el-form-item>
        <el-form-item label="單價" prop="price">
          <el-input-number v-model="form.price" :precision="2" :min="0" class="w-full" />
        </el-form-item>
        <el-form-item label="手續費">
          <el-input-number v-model="form.fee" :min="0" class="w-full" placeholder="選填" />
        </el-form-item>
        <div class="text-right text-sm text-gray-500 mb-2" v-if="form.shares && form.price">
          總金額：{{ ((form.shares * form.price) + (form.fee || 0)).toLocaleString() }} 元
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">確認新增</el-button>
      </template>
    </el-dialog>
  </div>
</template>
