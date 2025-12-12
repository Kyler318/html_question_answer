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
import { ref } from 'vue';
const emit = defineEmits(['join']);
const playerName = ref('');
const selectMode = (mode) => emit('join', { mode, playerName: playerName.value });
</script>

<style scoped>
.lobby-container { padding: 10px; }

.cyber-box {
  background: #0f101a;
  border: 1px solid #00f3ff;
  padding: 30px;
  box-shadow: 0 0 20px rgba(0,243,255,0.1);
  position: relative;
  overflow: hidden;
}
/* 掃描線動畫 */
.scan-line {
  position: absolute; top:0; left:0; width: 100%; height: 2px;
  background: rgba(0,243,255,0.5);
  animation: scan 3s linear infinite;
}
@keyframes scan { 0% {top:0} 100% {top:100%} }

.header h3 {
  color: #00f3ff; margin: 0 0 20px 0; letter-spacing: 3px;
  border-bottom: 1px solid #333; padding-bottom: 10px;
  font-family: 'Courier New', Courier, monospace;
}

label { color: #555; font-size: 0.7rem; font-weight: bold; display: block; margin-bottom: 5px; letter-spacing: 1px; }

input {
  width: 100%; background: rgba(0,0,0,0.3); border: 1px solid #333;
  color: #fff; padding: 15px; font-size: 1.2rem; outline: none; margin-bottom: 20px;
  font-family: 'Courier New'; transition: 0.3s;
}
input:focus { border-color: #e94560; box-shadow: 0 0 10px rgba(233,69,96,0.2); }

.grid-btns { display: grid; gap: 10px; }

.mode-btn {
  background: linear-gradient(90deg, transparent 50%, rgba(0,243,255,0.1) 100%);
  border: 1px solid #333; color: #fff; padding: 15px;
  text-align: left; cursor: pointer; transition: 0.2s;
  position: relative;
}
.mode-btn:hover { border-color: #00f3ff; background: rgba(0,243,255,0.1); transform: translateX(5px); }
.mode-btn.danger:hover { border-color: #ff0055; background: rgba(255,0,85,0.1); }

.glitch-text { font-size: 1.2rem; font-weight: bold; font-family: 'Arial Black'; }
.sub { font-size: 0.8rem; color: #666; }
.mode-btn:hover .sub { color: #aaa; }
</style>