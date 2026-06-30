<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const LINE_LOGIN_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID
const router = useRouter()
const authStore = useAuthStore()
const error = ref('')
const loading = ref(false)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return

  loading.value = true
  try {
    const redirectUri = `${window.location.origin}/login`
    const { data } = await axios.post(`${API}/api/auth/line`, { code, redirectUri })
    authStore.setToken(data.token, data.displayName)
    window.history.replaceState({}, '', '/login')
    router.push('/')
  } catch (e) {
    error.value = '登入失敗，請再試一次'
  } finally {
    loading.value = false
  }
})

function loginWithLine() {
  const redirectUri = `${window.location.origin}/login`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_LOGIN_CHANNEL_ID,
    redirect_uri: redirectUri,
    state: Math.random().toString(36).slice(2),
    scope: 'profile openid',
  })
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
      <div class="text-4xl mb-3">📈</div>
      <h1 class="text-2xl font-bold text-gray-800 mb-1">股小秘</h1>
      <p class="text-gray-500 text-sm mb-8">台股投資組合追蹤</p>

      <div v-if="loading" class="text-gray-500 text-sm py-4">登入中...</div>

      <div v-else>
        <button
          @click="loginWithLine"
          class="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.02 2 11c0 3.53 2.12 6.62 5.27 8.37L6.5 22l3.13-1.64C10.37 20.77 11.17 21 12 21c5.52 0 10-4.02 10-9s-4.48-9-10-9z"/>
          </svg>
          用 LINE 登入
        </button>

        <p v-if="error" class="text-red-500 text-sm mt-4">{{ error }}</p>
      </div>
    </div>
  </div>
</template>
