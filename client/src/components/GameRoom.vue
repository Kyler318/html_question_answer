<template>
  <div class="game-room">
    <div class="vfx-grid"></div>

    <div class="status-bar">
      <div class="room-tag">ROOM: {{ roomInfo.id.substr(0,4) }}</div>
      <div class="score-tag">SCORE: {{ myScore }}</div>
    </div>

    <div v-if="status === 'waiting'" class="waiting-area">
      <h2 class="neon-text">SYSTEM STANDBY</h2>
      <div class="player-list">
        <div v-for="p in roomInfo.players" :key="p.id" 
             class="player-card" :class="{ 'ready': roomInfo.readyStatus[p.id] }">
          <div class="p-name">{{ p.name }}</div>
          <div class="p-status">{{ roomInfo.readyStatus[p.id] ? 'READY' : '...' }}</div>
        </div>
      </div>
      <button v-if="!amIReady" class="btn-ready" @click="sendReady">INITIALIZE</button>
      <div v-else class="ready-msg">WAITING FOR PLAYERS...</div>
    </div>

    <div v-else-if="status === 'playing'" class="game-area">
      <div class="timer-container" v-if="phase === 'answering'">
        <div class="timer-bar" :key="currentQuestion?.id"></div>
      </div>
      <div v-else class="timer-placeholder">REVEALING DATA...</div>

      <div v-if="currentQuestion" class="question-box">
        <div class="category">{{ currentQuestion.category }}</div>
        <h2 class="q-text">{{ currentQuestion.question }}</h2>
        
        <div class="options-grid">
          <button 
            v-for="(opt, index) in currentQuestion.options" 
            :key="index"
            class="opt-btn"
            :class="getOptionClass(index)"
            @click="handleAnswer(index)"
            :disabled="hasAnswered || phase === 'reveal'"
          >
            <span class="icon-marker" v-if="phase === 'reveal'">
               <span v-if="index === correctIndex">✅</span>
               <span v-else-if="index === selectedIndex">❌</span>
               <span v-else>⚫</span>
            </span>
            <span class="index" v-else>0{{ index + 1 }}</span>
            {{ opt }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="status === 'finished'" class="result-area">
      <h1 class="neon-text">GAME OVER</h1>
      <div class="rank-list">
        <div v-for="(score, id) in scores" :key="id" class="rank-item">
          <span>{{ getPlayerName(id) }}</span>
          <span class="final-score">{{ score }}</span>
        </div>
      </div>
      <button class="btn-restart" @click="reload">RECONNECT</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps(['socket', 'roomInfo']);
const status = ref('waiting');
const phase = ref('answering'); // answering | reveal
const currentQuestion = ref(null);
const selectedIndex = ref(-1);
const correctIndex = ref(-1);
const hasAnswered = ref(false);
const scores = ref({});

// 音效
const audio = {
  bgm: new Audio('/audio/bgm.mp3'),
  correct: new Audio('/audio/correct.mp3'),
  wrong: new Audio('/audio/wrong.mp3'),
  ready: new Audio('/audio/ready.mp3'),
};
audio.bgm.loop = true;
audio.bgm.volume = 0.3;

const myId = props.socket.id;
const myScore = computed(() => scores.value[myId] || 0);
const amIReady = computed(() => props.roomInfo.readyStatus?.[myId]);

const getPlayerName = (id) => props.roomInfo.players.find(p => p.id === id)?.name || 'Unknown';
const reload = () => location.reload();

const sendReady = () => {
  audio.ready.play();
  props.socket.emit('playerReady', props.roomInfo.id);
};

const handleAnswer = (index) => {
  if (hasAnswered.value) return;
  hasAnswered.value = true;
  selectedIndex.value = index;
  props.socket.emit('submitAnswer', { roomId: props.roomInfo.id, answerIndex: index });
};

// 計算按鈕樣式
const getOptionClass = (index) => {
  if (phase.value === 'answering') {
    // 作答中：只顯示選了哪個 (黃色)
    if (index === selectedIndex.value) return 'selected-waiting';
  } else {
    // 揭曉中：顯示對錯
    if (index === correctIndex.value) return 'correct-reveal'; // 正解 (綠)
    if (index === selectedIndex.value && index !== correctIndex.value) return 'wrong-reveal'; // 選錯 (紅)
  }
  return '';
};

// Socket Events
props.socket.on('gameStart', () => {
  status.value = 'playing';
  audio.bgm.play().catch(()=>{});
});

props.socket.on('newQuestion', (q) => {
  currentQuestion.value = q;
  phase.value = 'answering';
  hasAnswered.value = false;
  selectedIndex.value = -1;
  correctIndex.value = -1;
});

// 接收回合結果 (這時候才揭曉)
props.socket.on('roundResult', (result) => {
  phase.value = 'reveal';
  scores.value = result.scores;
  correctIndex.value = result.correctAnswer;

  // 播放音效
  if (selectedIndex.value === result.correctAnswer) {
    audio.correct.play();
  } else if (selectedIndex.value !== -1) {
    audio.wrong.play(); // 有回答但錯了
  } else {
    // 沒回答 (Time's up)
    audio.wrong.play();
  }
});

props.socket.on('gameOver', (finalScores) => {
  scores.value = finalScores;
  status.value = 'finished';
  audio.bgm.pause();
});
</script>

<style scoped>
/* 樣式繼承之前的，這裡只列出新增/修改的 */
.game-room { 
  background: #0b0c15; color: #fff; min-height: 500px; padding: 20px; 
  position: relative; overflow: hidden; border: 1px solid #333;
}
.vfx-grid { /* 同上個版本 */ position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(0,255,255,0.05) 1px, transparent 1px) 0 0 / 30px 30px; animation: gridMove 20s linear infinite; z-index:0; pointer-events:none;}
@keyframes gridMove { to { transform: translateY(30px); } }

.waiting-area, .game-area, .result-area { position: relative; z-index: 2; }
.status-bar { display: flex; justify-content: space-between; margin-bottom: 20px; font-family: 'Consolas'; color: #00f3ff; }

/* 按鈕樣式 */
.opt-btn {
  width: 100%; padding: 20px; margin-bottom: 10px;
  background: rgba(255,255,255,0.05); border: 1px solid #333; color: #aaa;
  text-align: left; font-size: 1.1rem; cursor: pointer; transition: 0.2s;
  display: flex; justify-content: space-between; align-items: center;
}
.opt-btn:hover:not(:disabled) { background: rgba(0,243,255,0.1); border-color: #00f3ff; color: #fff; }

/* 狀態顏色 */
.selected-waiting { background: #d4ac0d !important; color: #000 !important; border-color: #f1c40f !important; box-shadow: 0 0 10px #f1c40f; }
.correct-reveal { background: #27ae60 !important; color: #fff !important; border-color: #2ecc71 !important; box-shadow: 0 0 15px #2ecc71; }
.wrong-reveal { background: #c0392b !important; color: #fff !important; border-color: #e74c3c !important; opacity: 0.8; }

.timer-container { height: 4px; background: #333; margin-bottom: 15px; }
.timer-bar { height: 100%; background: #00f3ff; animation: timer 10s linear forwards; }
@keyframes timer { to { width: 0%; background: #ff0055; } }
.timer-placeholder { height: 4px; margin-bottom: 15px; color: #00f3ff; font-size: 0.8rem; letter-spacing: 2px; text-align: right; }

/* 大廳準備按鈕 */
.btn-ready { width: 100%; padding: 15px; border: 1px solid #00f3ff; color: #00f3ff; background: transparent; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; }
.btn-ready:hover { background: #00f3ff; color: #000; box-shadow: 0 0 15px #00f3ff; }
.player-list { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
.player-card { border: 1px solid #444; padding: 10px; width: 100px; text-align: center; font-size: 0.8rem; opacity: 0.5; }
.player-card.ready { border-color: #00f3ff; opacity: 1; box-shadow: 0 0 10px rgba(0,243,255,0.2); }
</style>