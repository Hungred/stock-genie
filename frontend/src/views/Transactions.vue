<script setup>
import { ref, onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

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

onMounted(() => store.fetchTransactions())

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
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">交易記錄</h1>
      <el-button type="primary" @click="showDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon>新增交易
      </el-button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
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

    <!-- 新增交易 Dialog -->
    <el-dialog v-model="showDialog" title="新增交易記錄" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="日期" prop="date">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" class="w-full" />
        </el-form-item>
        <el-form-item label="股票代號" prop="code">
          <el-input v-model="form.code" placeholder="如：0050" />
        </el-form-item>
        <el-form-item label="股票名稱">
          <el-input v-model="form.name" placeholder="如：元大台灣50" />
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
