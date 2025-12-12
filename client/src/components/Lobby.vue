<template>
  <div class="lobby-container">
    <div class="cyber-box">
      <div class="header">
        <div class="scan-line"></div>
        <h3>IDENTITY LOGIN</h3>
      </div>

      <div class="form-group">
        <label>CODENAME</label>
        <input v-model="playerName" placeholder="ENTER NAME..." maxlength="8" />
      </div>
      
      <div class="mode-group" v-if="playerName">
        <label>SELECT PROTOCOL</label>
        <div class="grid-btns">
          <button class="mode-btn" @click="selectMode(2)">
            <div class="glitch-text">DUEL</div>
            <div class="sub">1 VS 1</div>
          </button>
          <button class="mode-btn" @click="selectMode(5)">
            <div class="glitch-text">BRAWL</div>
            <div class="sub">5 PLAYERS</div>
          </button>
          <button class="mode-btn danger" @click="selectMode(30)">
            <div class="glitch-text">ROYALE</div>
            <div class="sub">30 PLAYERS</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 👇 1. 這裡必須引入 ref
import { ref } from 'vue';

const props = defineProps(['user']);
// 👇 2. 定義 emit 以便傳送資料給父組件
const emit = defineEmits(['join']);

const playerName = ref('');

// 自動填入邏輯
if (props.user) {
  if (props.user.displayName) {
    playerName.value = props.user.displayName;
  } else if (props.user.email) {
    playerName.value = props.user.email.replace('@cyber.net', '').toUpperCase();
  }
}

// 👇 3. 補上按鈕觸發的函式
const selectMode = (mode) => {
  emit('join', { mode, playerName: playerName.value });
};
</script>