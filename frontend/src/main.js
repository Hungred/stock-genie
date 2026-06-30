import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import axios from 'axios'
import router from './router'
import App from './App.vue'
import './style.css'

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('sg_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhTw })
app.mount('#app')
