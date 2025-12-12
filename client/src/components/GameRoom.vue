<template>
  <div class="game-room">
    <!-- vfx-grid 已經移到 App.vue 或 global.css 做為全局背景 -->

    <div class="status-bar">
      <div class="room-tag">ROOM: {{ roomInfo.id.substr(0,4) }}</div>
      <div class="score-tag">
        SCORE: {{ myScore }}
        <span v-if="showScoreDiff" class="score-popup">+{{ scoreDiff }}</span>
      </div>
    </div>
    
    <div v-if="status === 'waiting'" class="waiting-area">
      <h2 class="neon-text">SYSTEM STANDBY</h2>
      <div class="player-list">
        <div v-for="p in roomInfo.players" :key="p.id" 
             class="player-card" :class="{ 'ready': roomInfo.readyStatus[p.id] }">
          <img :src="p.photoURL || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'" 
          style="width:30px; height:30px; border-radius:50%; display:block; margin:0 auto;">
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
const scoreDiff = ref(0);
const showScoreDiff = ref(false);

// 音效 (建議將來也移到獨立的 js 模組)
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
    if (index === selectedIndex.value) return 'selected-waiting';
  } else {
    if (index === correctIndex.value) return 'correct-reveal';
    if (index === selectedIndex.value && index !== correctIndex.value) return 'wrong-reveal';
  }
  return '';
};

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

props.socket.on('roundResult', (result) => {
  phase.value = 'reveal';
  correctIndex.value = result.correctAnswer;

  // --- 新增：計算分數差 ---
  const oldScore = scores.value[myId] || 0;     // 取得目前分數
  const newScore = result.scores[myId] || 0;    // 取得新分數
  const diff = newScore - oldScore;             // 計算差額

  if (diff > 0) {
    scoreDiff.value = diff;
    showScoreDiff.value = true;
    
    // 2秒後隱藏動畫
    setTimeout(() => {
      showScoreDiff.value = false;
    }, 2000);
  }
  // --------------------

    // 更新分數
  scores.value = result.scores;

  // 播放音效 (保持原有邏輯)
  if (selectedIndex.value === result.correctAnswer) {
    audio.correct.play();
  } else if (selectedIndex.value !== -1) {
    audio.wrong.play(); 
  } else {
    audio.wrong.play();
  }
  });
props.socket.on('gameOver', (finalScores) => {
  scores.value = finalScores;
  status.value = 'finished';
  audio.bgm.pause();
});
</script>