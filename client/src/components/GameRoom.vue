<template>
  <div class="game-room">
    <div class="status-bar">
      <div class="room-tag">ROOM: {{ roomInfo.id.substr(0,4) }}</div>
      <div class="score-tag">
        SCORE: {{ myScore }}
        <span v-if="showScoreDiff" class="score-popup">+{{ scoreDiff }}</span>
      </div>
    </div>

    <!-- 狀態 1: 等待開始 -->
    <div v-if="status === 'waiting'" class="waiting-area">
      <h2 class="neon-text">SYSTEM STANDBY</h2>
      <div class="player-list">
        <div v-for="p in roomInfo.players" :key="p.id" 
             class="player-card" :class="{ 'ready': roomInfo.readyStatus[p.id] }">
          <!-- 顯示頭像 -->
          <img :src="p.photoURL || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'" class="p-avatar">
          <div class="p-name">{{ p.name }}</div>
          <div class="p-status">{{ roomInfo.readyStatus[p.id] ? 'READY' : '...' }}</div>
        </div>
      </div>
      <button v-if="!amIReady" class="btn-ready" @click="sendReady">INITIALIZE</button>
      <div v-else class="ready-msg">WAITING FOR OTHERS...</div>
    </div>

    <!-- 狀態 2: 遊戲進行中 -->
    <div v-else-if="status === 'playing'" class="game-area">
      <!-- 計時器 -->
      <div class="timer-container" v-if="phase === 'answering' || phase === 'waiting_others'">
        <!-- key 用 currentQuestion.id 確保切換題目時動畫重置 -->
        <div class="timer-bar" :key="currentQuestion?.id"></div>
      </div>
      <div v-else class="timer-placeholder">DATA ANALYSIS...</div>

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
            :disabled="hasAnswered || phase !== 'answering'"
          >
            <!-- 顯示選取狀態或結果 -->
            <span class="icon-marker" v-if="phase === 'reveal'">
               <span v-if="index === correctIndex">✅</span>
               <span v-else-if="index === selectedIndex && index !== correctIndex">❌</span>
               <span v-else>⚫</span>
            </span>
            <span class="index" v-else>0{{ index + 1 }}</span>
            {{ opt }}
          </button>
        </div>

        <!-- ✨ 新增：等待對手提示 -->
        <div v-if="phase === 'waiting_others'" class="waiting-msg">
          WAITING FOR OPPONENTS...
        </div>
      </div>
    </div>

    <!-- 狀態 3: 遊戲結束 -->
    <div v-else-if="status === 'finished'" class="result-area">
      <h1 class="neon-text">MISSION COMPLETE</h1>
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
// phase 狀態: answering (作答中) | waiting_others (等別人) | reveal (揭曉)
const phase = ref('answering'); 
const currentQuestion = ref(null);
const selectedIndex = ref(-1);
const correctIndex = ref(-1);
const hasAnswered = ref(false);
const scores = ref({});
const scoreDiff = ref(0);
const showScoreDiff = ref(false);

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
  
  // ✨ 改成：送出後進入「等待他人」狀態，不馬上揭曉
  phase.value = 'waiting_others';
  
  props.socket.emit('submitAnswer', { roomId: props.roomInfo.id, answerIndex: index });
};

const getOptionClass = (index) => {
  if (phase.value === 'answering') {
    return '';
  } 
  else if (phase.value === 'waiting_others') {
    // 等待時，只高亮自己選的，不顯示對錯
    if (index === selectedIndex.value) return 'selected-waiting';
  }
  else if (phase.value === 'reveal') {
    // 揭曉時，顯示對錯
    if (index === correctIndex.value) return 'correct-reveal';
    if (index === selectedIndex.value && index !== correctIndex.value) return 'wrong-reveal';
  }
  return '';
};

// --- Socket 監聽 ---

props.socket.on('gameStart', () => {
  status.value = 'playing';
  audio.bgm.play().catch(()=>{});
});

props.socket.on('newQuestion', (q) => {
  currentQuestion.value = q;
  phase.value = 'answering'; // 重置為作答狀態
  hasAnswered.value = false;
  selectedIndex.value = -1;
  correctIndex.value = -1;
});

// 收到結果 (這時候才揭曉)
props.socket.on('roundResult', (result) => {
  phase.value = 'reveal';
  correctIndex.value = result.correctAnswer;
  
  // 計算分數差
  const oldScore = scores.value[myId] || 0;
  const newScore = result.scores[myId] || 0;
  const diff = newScore - oldScore;

  if (diff > 0) {
    scoreDiff.value = diff;
    showScoreDiff.value = true;
    setTimeout(() => { showScoreDiff.value = false; }, 2000);
    audio.correct.play();
  } else {
    // 沒加分 = 答錯 或 沒答
    audio.wrong.play();
  }

  scores.value = result.scores;
});

props.socket.on('gameOver', (finalScores) => {
  scores.value = finalScores;
  status.value = 'finished';
  audio.bgm.pause();
});
</script>