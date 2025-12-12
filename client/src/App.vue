<template>
  <div class="app-container">
    <header class="main-header">
      <h1 class="glitch-title">&lt;HTML/CSS Battle /&gt;</h1>
      <p class="subtitle">連線代碼知識對戰</p>
    </header>
    
    <div class="content-box">
      <div v-if="!joinedRoom">
        <Lobby @join="handleJoin" />
      </div>
      <div v-else>
        <GameRoom :socket="socket" :roomInfo="roomInfo" />
      </div>
    </div>
  </div>
</template>

<script setup>
// ... (保留你原本的 script)
import { ref } from 'vue';
import io from 'socket.io-client';
import Lobby from './components/Lobby.vue';
import GameRoom from './components/GameRoom.vue';

const socket = io('http://localhost:3000'); 
const joinedRoom = ref(false);
const roomInfo = ref({});

const handleJoin = (payload) => {
  socket.emit('joinRoom', payload);
};

socket.on('updateRoom', (data) => {
  roomInfo.value = data;
  joinedRoom.value = true;
});
</script>

<style scoped>
.app-container {
  width: 100%;
  max-width: 600px;
  margin-top: 40px;
  padding: 20px;
}

.main-header {
  text-align: center;
  margin-bottom: 30px;
}

.glitch-title {
  font-family: var(--font-code);
  font-size: 2.5rem;
  color: var(--accent);
  text-shadow: 2px 2px 0px #000;
  margin: 0;
}

.subtitle {
  color: var(--text-sub);
  margin-top: 5px;
  letter-spacing: 2px;
}

.content-box {
  background: var(--card-bg);
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.1);
}
</style>