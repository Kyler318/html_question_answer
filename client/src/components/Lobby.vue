<template>
  <div class="lobby-container">
    <div class="cyber-box">
      <div class="header">
        <div class="scan-line"></div>
        <!-- 動態標題 -->
        <h3>{{ getTitle() }}</h3>
      </div>

      <!-- 步驟 0: 名字 (自動填入後通常隱藏，或保留讓使用者確認) -->
      <div class="form-group" v-if="step === 1">
        <label>CODENAME</label>
        <input v-model="playerName" placeholder="ENTER NAME..." maxlength="8" />
      </div>

      <!-- 步驟 1: 選擇人數模式 -->
      <div class="mode-group" v-if="step === 1 && playerName">
        <label>SELECT PROTOCOL (MODE)</label>
        <div class="grid-btns">
          <button class="mode-btn" @click="chooseMode(2)">
            <div class="glitch-text">DUEL</div>
            <div class="sub">1 VS 1</div>
          </button>
          <button class="mode-btn" @click="chooseMode(5)">
            <div class="glitch-text">BRAWL</div>
            <div class="sub">5 PLAYERS</div>
          </button>
          <button class="mode-btn danger" @click="chooseMode(30)">
            <div class="glitch-text">ROYALE</div>
            <div class="sub">30 PLAYERS</div>
          </button>
        </div>
      </div>

      <!-- 步驟 2: 選擇 創建 或 加入 -->
      <div class="action-group" v-if="step === 2">
        <div class="selected-info">MODE: {{ selectedMode }} PLAYERS</div>
        
        <div class="grid-btns">
          <!-- 創建房間 -->
          <button class="mode-btn create" @click="handleCreate">
            <div class="glitch-text">CREATE ROOM</div>
            <div class="sub">GENERATE NEW ID</div>
          </button>

          <!-- 進入輸入房號畫面 -->
          <button class="mode-btn join" @click="step = 3">
            <div class="glitch-text">JOIN ROOM</div>
            <div class="sub">ENTER ROOM ID</div>
          </button>
          
          <button class="mode-btn back" @click="step = 1">BACK</button>
        </div>
      </div>

      <!-- 步驟 3: 輸入房號 -->
      <div class="input-group" v-if="step === 3">
        <label>ENTER ROOM ID (4-DIGIT)</label>
        <input 
          v-model="inputRoomId" 
          type="text" 
          placeholder="0000" 
          maxlength="4" 
          class="room-input"
        />
        
        <div class="grid-btns">
          <button class="mode-btn confirm" @click="handleJoin">CONNECT</button>
          <button class="mode-btn back" @click="step = 2">BACK</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps(['user']);
const emit = defineEmits(['create', 'join']);

const playerName = ref('');
const step = ref(1);           // 1=選模式, 2=選動作, 3=輸入房號
const selectedMode = ref(0);
const inputRoomId = ref('');

// 自動填入名字
if (props.user) {
  if (props.user.displayName) {
    playerName.value = props.user.displayName;
  } else if (props.user.email) {
    playerName.value = props.user.email.replace('@cyber.net', '').toUpperCase();
  }
}

const getTitle = () => {
    if (step.value === 1) return 'IDENTITY LOGIN';
    if (step.value === 2) return 'SELECT ACTION';
    if (step.value === 3) return 'SECURITY CHECK';
    return 'SYSTEM';
}

const chooseMode = (mode) => {
  selectedMode.value = mode;
  step.value = 2;
};

const handleCreate = () => {
  emit('create', { 
    mode: selectedMode.value, 
    playerName: playerName.value 
  });
};

const handleJoin = () => {
  if (!inputRoomId.value || inputRoomId.value.length !== 4) {
    alert('請輸入 4 位數房間號碼 (ENTER 4 DIGITS)');
    return;
  }
  emit('join', { 
    roomId: inputRoomId.value, 
    playerName: playerName.value 
  });
};
</script>

<style scoped>
/* 繼承原有的 lobby.css 樣式，這裡只加強特定元素 */
.selected-info {
  text-align: center; color: var(--c-primary); margin-bottom: 20px;
  font-family: var(--font-hud); letter-spacing: 2px; border-bottom: 1px solid #333; padding-bottom: 10px;
}
.room-input {
  font-size: 2rem !important; text-align: center; letter-spacing: 10px;
  color: var(--c-warning) !important; border-color: var(--c-warning) !important;
  font-family: 'Courier New', Courier, monospace;
}
/* 按鈕顏色區分 */
.create { border-color: var(--c-success); }
.create:hover { background: rgba(46, 204, 113, 0.1); box-shadow: 0 0 10px rgba(46, 204, 113, 0.3); }

.join { border-color: var(--c-primary); }

.confirm { border-color: var(--c-warning); color: var(--c-warning); }
.confirm:hover { background: rgba(241, 196, 15, 0.1); box-shadow: 0 0 10px rgba(241, 196, 15, 0.3); }

.back { border-color: #666; color: #888; }
.back:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: #fff; }
</style>