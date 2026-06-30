import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TOKEN_KEY = 'sg_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || null)
  const displayName = ref('')

  const isLoggedIn = computed(() => !!token.value)

  function setToken(t, name = '') {
    token.value = t
    displayName.value = name
    localStorage.setItem(TOKEN_KEY, t)
  }

  function logout() {
    token.value = null
    displayName.value = ''
    localStorage.removeItem(TOKEN_KEY)
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const { data } = await axios.get(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      displayName.value = data.display_name || ''
    } catch {
      logout()
    }
  }

  return { token, displayName, isLoggedIn, setToken, logout, fetchMe }
})
