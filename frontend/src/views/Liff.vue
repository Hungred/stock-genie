<script setup>
import { onMounted, ref } from 'vue'
import liff from '@line/liff'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const LIFF_ID = import.meta.env.VITE_LIFF_ID
const WEB_URL = import.meta.env.VITE_WEB_URL || window.location.origin

const status = ref('loading')
const displayName = ref('')
const errorMsg = ref('')

onMounted(async () => {
  try {
    await liff.init({ liffId: LIFF_ID })

    if (!liff.isLoggedIn()) {
      liff.login()
      return
    }

    const idToken = liff.getIDToken()
    const { data } = await axios.post(`${API}/api/auth/liff`, { idToken })

    const profile = liff.getDecodedIDToken()
    displayName.value = profile?.name || ''
    localStorage.setItem('sg_token', data.token)

    status.value = 'success'
  } catch (e) {
    errorMsg.value = e.message
    status.value = 'error'
  }
})

function openWeb() {
  liff.openWindow({ url: WEB_URL, external: true })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">

      <div v-if="status === 'loading'" class="text-gray-500">
        <div class="text-3xl mb-3">⏳</div>
        <p>建立帳號中...</p>
      </div>

      <div v-else-if="status === 'success'">
        <div class="text-4xl mb-3">✅</div>
        <h2 class="text-xl font-bold text-gray-800 mb-1">帳號已建立</h2>
        <p class="text-gray-500 text-sm mb-6">{{ displayName }}，歡迎使用股小秘！</p>
        <button
          @click="openWeb"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          開啟網頁版
        </button>
      </div>

      <div v-else>
        <div class="text-4xl mb-3">❌</div>
        <p class="text-red-500 text-sm">{{ errorMsg }}</p>
      </div>

    </div>
  </div>
</template>
