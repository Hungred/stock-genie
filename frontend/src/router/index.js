import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Holdings from '../views/Holdings.vue'
import Transactions from '../views/Transactions.vue'
import Dividends from '../views/Dividends.vue'
import Login from '../views/Login.vue'
import Liff from '../views/Liff.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/holdings', name: 'Holdings', component: Holdings, meta: { requiresAuth: true } },
  { path: '/transactions', name: 'Transactions', component: Transactions, meta: { requiresAuth: true } },
  { path: '/dividends', name: 'Dividends', component: Dividends, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: Login },
  { path: '/liff', name: 'Liff', component: Liff },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  // LIFF 跳轉外部瀏覽器時 token 帶在 URL，存入 localStorage 後移除
  const urlParams = new URLSearchParams(window.location.search)
  const tokenFromUrl = urlParams.get('sg_token')
  if (tokenFromUrl) {
    localStorage.setItem('sg_token', tokenFromUrl)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const token = localStorage.getItem('sg_token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
