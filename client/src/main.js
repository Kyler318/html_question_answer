import { createApp } from 'vue'
import App from './App.vue'

// 樣式引入順序
import './assets/styles/variables.css'
import './assets/styles/animations.css'
import './assets/styles/global.css'
import './assets/styles/app.css'
import './assets/styles/lobby.css'
import './assets/styles/gameroom.css'
import './assets/styles/auth.css'        // ✨ 新增
import './assets/styles/userprofile.css' // ✨ 新增

createApp(App).mount('#app')