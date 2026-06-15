<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', label: '總覽', icon: 'DataLine' },
  { path: '/holdings', label: '持股', icon: 'PieChart' },
  { path: '/transactions', label: '交易', icon: 'List' },
  { path: '/dividends', label: '配息', icon: 'Money' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 pb-16 md:pb-0">

    <!-- 頂部 Navbar（桌機） -->
    <nav class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-2">
            <span class="text-xl">📈</span>
            <span class="font-bold text-gray-800 text-lg">股小秘</span>
          </div>
          <!-- 桌機選單 -->
          <div class="hidden md:flex gap-1">
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
    <main class="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-6">
      <router-view />
    </main>

    <!-- 底部 Tab Bar（手機） -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
      <div class="flex">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
          :class="route.path === item.path
            ? 'text-blue-600'
            : 'text-gray-400'"
        >
          <el-icon class="text-xl"><component :is="item.icon" /></el-icon>
          <span class="text-xs font-medium">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

  </div>
</template>
