<template>
  <div class="vfx-grid"></div>
  
  <div class="app-container">
    <header class="main-header">
      <h1 class="glitch-title">&lt;HTML/CSS Battle /&gt;</h1>
    </header>

    <div v-if="loading" class="loading-text">INITIALIZING...</div>

    <div v-else-if="!currentUser">
      <Auth />
    </div>

    <!-- 登入後的區塊 -->
    <div v-else>
      <UserProfile />

      <div class="content-box">
        <div v-if="!joinedRoom">
          <!-- 綁定 create 和 join 事件 -->
          <Lobby 
            :user="currentUser" 
            @create="handleCreate" 
            @join="handleJoin" 
          />
        </div>
        <div v-else>
          <GameRoom :socket="socket" :roomInfo="roomInfo" />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import io from 'socket.io-client';
import { auth } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';

import Lobby from './components/Lobby.vue';
import GameRoom from './components/GameRoom.vue';
import Auth from './components/Auth.vue';
import UserProfile from './components/UserProfile.vue';

// 連線設定：Production 用環境變數，Local 用 localhost
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const socket = io(apiUrl);

const joinedRoom = ref(false);
const roomInfo = ref({});
const currentUser = ref(null);
const loading = ref(true);

// 監聽 Firebase 登入狀態
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    loading.value = false;
  });

  // 監聽伺服器回傳的錯誤 (例如房間不存在)
  socket.on('errorMsg', (msg) => {
    alert(msg);
  });
});

// 處理創建房間
const handleCreate = (payload) => {
  const playerData = {
    ...payload,
    photoURL: currentUser.value?.photoURL || null
  };
  socket.emit('createRoom', playerData);
};

// 處理加入房間
const handleJoin = (payload) => {
  const playerData = {
    ...payload,
    photoURL: currentUser.value?.photoURL || null
  };
  socket.emit('joinRoom', playerData);
};

// 房間資訊更新 (成功加入後)
socket.on('updateRoom', (data) => {
  roomInfo.value = data;
  joinedRoom.value = true;
});
</script>

<style scoped>
.loading-text { 
  text-align: center; color: var(--c-primary); 
  font-size: 1.5rem; animation: pulse 1s infinite; margin-top: 100px;
}
</style>