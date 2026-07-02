<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const showNav = computed(() => !['Login', 'Liff'].includes(route.name))

const navItems = [
  { path: '/', label: '總覽', icon: 'DataLine' },
  { path: '/holdings', label: '持股', icon: 'PieChart' },
  { path: '/watchlist', label: '自選', icon: 'Star' },
  { path: '/transactions', label: '交易', icon: 'List' },
  { path: '/dividends', label: '配息', icon: 'Money' },
]

onMounted(() => {
  if (authStore.isLoggedIn) authStore.fetchMe()
})

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50" :class="showNav ? 'pb-16 md:pb-0' : ''">

    <!-- 頂部 Navbar（桌機） -->
    <nav v-if="showNav" class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center">
            <img src="/logo.png" alt="股小秘" class="h-10 w-auto" />
          </div>
          <!-- 手機登出按鈕 -->
          <button
            class="md:hidden text-gray-400 hover:text-red-500 transition-colors p-1"
            @click="logout"
            title="登出"
          >
            <el-icon class="text-xl"><SwitchButton /></el-icon>
          </button>

          <!-- 桌機選單 -->
          <div class="hidden md:flex items-center gap-1">
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
            <div class="ml-3 pl-3 border-l border-gray-200 flex items-center gap-2">
              <span v-if="authStore.displayName" class="text-sm text-gray-500">{{ authStore.displayName }}</span>
              <button
                @click="logout"
                class="text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded"
              >登出</button>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- 頁面內容 -->
    <main class="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-6">
      <router-view />
    </main>

    <!-- 底部 Tab Bar（手機） -->
    <nav v-if="showNav" class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
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
