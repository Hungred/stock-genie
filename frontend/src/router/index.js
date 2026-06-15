import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Holdings from '../views/Holdings.vue'
import Transactions from '../views/Transactions.vue'
import Dividends from '../views/Dividends.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/holdings', name: 'Holdings', component: Holdings },
  { path: '/transactions', name: 'Transactions', component: Transactions },
  { path: '/dividends', name: 'Dividends', component: Dividends },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
