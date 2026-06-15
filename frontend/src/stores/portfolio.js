import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const usePortfolioStore = defineStore('portfolio', () => {
  const holdings = ref([])
  const transactions = ref([])
  const dividends = ref([])
  const loading = ref(false)
  const error = ref(null)

  const totalCost = computed(() =>
    holdings.value.reduce((sum, h) => sum + h.total_cost, 0)
  )
  const totalValue = computed(() =>
    holdings.value.reduce((sum, h) => sum + h.current_value, 0)
  )
  const totalPnl = computed(() => totalValue.value - totalCost.value)
  const totalPnlPercent = computed(() =>
    totalCost.value ? ((totalPnl.value / totalCost.value) * 100).toFixed(2) : 0
  )

  async function fetchHoldings() {
    loading.value = true
    try {
      const { data } = await axios.get(`${API}/api/holdings`)
      holdings.value = data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchTransactions() {
    loading.value = true
    try {
      const { data } = await axios.get(`${API}/api/transactions`)
      transactions.value = data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addTransaction(payload) {
    const { data } = await axios.post(`${API}/api/transactions`, payload)
    await fetchHoldings()
    return data
  }

  async function fetchDividends() {
    const { data } = await axios.get(`${API}/api/dividends`)
    dividends.value = data
  }

  return {
    holdings, transactions, dividends,
    loading, error,
    totalCost, totalValue, totalPnl, totalPnlPercent,
    fetchHoldings, fetchTransactions, addTransaction, fetchDividends,
  }
})
