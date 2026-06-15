<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const navItems = [
  { path: '/', label: '總覽', icon: 'DataLine' },
  { path: '/holdings', label: '持股明細', icon: 'PieChart' },
  { path: '/transactions', label: '交易記錄', icon: 'List' },
  { path: '/dividends', label: '配息', icon: 'Money' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 頂部導覽 -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-2">
            <span class="text-xl">📈</span>
            <span class="font-bold text-gray-800 text-lg">股小秘</span>
          </div>
          <div class="flex gap-1">
            <router-link
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="route.path === item.path
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              {{ item.label }}
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- 頁面內容 -->
    <main class="max-w-6xl mx-auto px-4 py-6">
      <router-view />
    </main>
  </div>
</template>
