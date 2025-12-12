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

    <!-- 👇 修改這裡：登入後的區塊 -->
    <div v-else>
      <!-- 1. 把 UserProfile 移到這裡 (content-box 的外面) -->
      <UserProfile />

      <!-- 2. 這裡只保留遊戲內容 -->
      <div class="content-box">
        <div v-if="!joinedRoom">
          <Lobby :user="currentUser" @join="handleJoin" />
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

// ----------------------------------------------------
// 【關鍵修改】自動判斷網址
// 如果是在 Vercel (Production)，它會讀取我們設定的環境變數
// 如果是在本地 (Localhost)，它會讀取 .env 檔案裡的 http://localhost:3000
// ----------------------------------------------------
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
});

const handleJoin = (payload) => {
  // 這裡可以把頭像 URL 也傳給後端
  const playerData = {
    ...payload,
    photoURL: currentUser.value.photoURL // 傳送頭像
  };
  socket.emit('joinRoom', playerData);
};

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