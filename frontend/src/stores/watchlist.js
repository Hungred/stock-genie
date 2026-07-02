import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useWatchlistStore = defineStore('watchlist', () => {
  const lists = ref([])
  const loading = ref(false)

  async function fetchLists() {
    const { data } = await axios.get(`${API}/api/watchlist`)
    lists.value = data
  }

  async function createList(name) {
    const { data } = await axios.post(`${API}/api/watchlist`, { name })
    lists.value.push(data)
    return data
  }

  async function deleteList(id) {
    await axios.delete(`${API}/api/watchlist/${id}`)
    lists.value = lists.value.filter(l => l.id !== id)
  }

  async function fetchStocks(listId) {
    const { data } = await axios.get(`${API}/api/watchlist/${listId}/stocks`)
    return data
  }

  async function addStock(listId, code, name) {
    await axios.post(`${API}/api/watchlist/${listId}/stocks`, { code, name })
  }

  async function removeStock(listId, code) {
    await axios.delete(`${API}/api/watchlist/${listId}/stocks/${code}`)
  }

  async function fetchHoldings() {
    const { data } = await axios.get(`${API}/api/watchlist/holdings`)
    return data
  }

  return { lists, loading, fetchLists, createList, deleteList, fetchStocks, addStock, removeStock, fetchHoldings }
})
