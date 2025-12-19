<template>
  <div class="game-room">
    <div class="status-bar">
      <div class="room-tag">ROOM: {{ roomInfo.id.substr(0,4) }}</div>
    </div>

    <div v-if="status === 'waiting'" class="waiting-area">
      <h2 class="neon-text">SYSTEM STANDBY</h2>
      <div class="player-list">
        <div v-for="p in roomInfo.players" :key="p.id" 
             class="player-card" :class="{ 'ready': roomInfo.readyStatus[p.id] }">
          <img :src="p.photoURL || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'" class="p-avatar">
          <div class="p-name">{{ p.name }}</div>
          <div class="p-status">{{ roomInfo.readyStatus[p.id] ? 'READY' : '...' }}</div>
        </div>
      </div>
      <button v-if="!amIReady" class="btn-ready" @click="sendReady">INITIALIZE</button>
      <div v-else class="ready-msg">WAITING FOR OTHERS...</div>
    </div>

    <div v-else-if="status === 'playing'" class="game-area">
      
      <div class="battle-stage">
        <canvas ref="battleCanvas" width="800" height="300"></canvas>
        
        <div class="hud-layer">
          <div v-for="(p, index) in playersList" :key="p.id" 
               class="hud-player" 
               :class="index === 0 ? 'p-left' : 'p-right'"
          >
            <div class="hud-name" :class="{ 'me': p.id === myId }">{{ p.name }}</div>
            <div class="hp-bar-container">
              <div class="hp-bar" :style="{ width: p.hp + '%', backgroundColor: getHpColor(p.hp) }"></div>
            </div>
            <div class="hp-text">{{ p.hp }} / 100</div>
          </div>
        </div>

        <transition name="pop">
          <div v-if="battleLog" class="battle-log-popup" :class="logType">
            {{ battleLog }}
          </div>
        </transition>
      </div>

      <div class="timer-container" v-if="phase === 'answering' || phase === 'waiting_others'">
        <div class="timer-bar" :key="currentQuestion?.id"></div>
      </div>

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
            <span class="icon-marker" v-if="phase === 'reveal'">
               <span v-if="index === correctIndex">✅</span>
               <span v-else-if="index === selectedIndex && index !== correctIndex">❌</span>
               <span v-else>⚫</span>
            </span>
            <span class="index" v-else>0{{ index + 1 }}</span>
            {{ opt }}
          </button>
        </div>

        <div v-if="phase === 'waiting_others'" class="waiting-msg">
          WAITING FOR OPPONENT...
        </div>
      </div>
    </div>

    <div v-else-if="status === 'finished'" class="result-area">
      <h1 class="neon-text">GAME OVER</h1>
      <div class="rank-list">
        <div v-for="p in playersList" :key="p.id" class="rank-item">
          <span>{{ p.name }}</span>
          <span class="final-score">{{ p.hp > 0 ? 'WINNER' : 'DEFEATED' }}</span>
        </div>
      </div>
      <button class="btn-restart" @click="reload">RECONNECT</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps(['socket', 'roomInfo']);
const status = ref('waiting');
const phase = ref('answering'); 
const currentQuestion = ref(null);
const selectedIndex = ref(-1);
const correctIndex = ref(-1);
const hasAnswered = ref(false);
const battleLog = ref('');
const logType = ref('info'); // info, success, danger

const playersList = ref(props.roomInfo.players || []);
const myId = props.socket.id;
const amIReady = computed(() => props.roomInfo.readyStatus?.[myId]);

// === 🎨 精靈圖動畫設定 ===
const battleCanvas = ref(null);
let ctx = null;
let animationFrameId = null;
const spriteImg = new Image();
// ⚠️ 請確保這張圖存在 public/img 資料夾中，或是換成網路圖庫連結
spriteImg.src = '/img/hero_sheet.png'; 

// 角色動畫狀態管理
// 假設 1v1，我們固定 P1 在左，P2 在右
const sprites = ref({}); 

const SPRITE_W = 100; // 單格寬 (請依實際圖片修改)
const SPRITE_H = 100; // 單格高
const SCALE = 2.5;   // 放大倍率

const audio = {
  bgm: new Audio('/audio/bgm.mp3'),
  attack: new Audio('/audio/correct.mp3'), // 攻擊音效
  hurt: new Audio('/audio/wrong.mp3'),     // 受傷音效
  ready: new Audio('/audio/ready.mp3'),
};
audio.bgm.loop = true;
audio.bgm.volume = 0.3;

const reload = () => location.reload();
const getHpColor = (hp) => hp > 50 ? '#4caf50' : (hp > 20 ? '#ff9800' : '#f44336');

// --- 核心邏輯 ---

watch(() => props.roomInfo.players, (newVal) => {
    if(status.value === 'waiting') playersList.value = newVal;
}, { deep: true });

const sendReady = () => {
  audio.ready.play();
  props.socket.emit('playerReady', props.roomInfo.id);
};

const handleAnswer = (index) => {
  if (hasAnswered.value) return;
  hasAnswered.value = true;
  selectedIndex.value = index;
  phase.value = 'waiting_others';
  props.socket.emit('submitAnswer', { roomId: props.roomInfo.id, answerIndex: index });
};

const getOptionClass = (index) => {
  if (phase.value === 'answering') return '';
  else if (phase.value === 'waiting_others') {
    if (index === selectedIndex.value) return 'selected-waiting';
  }
  else if (phase.value === 'reveal') {
    if (index === correctIndex.value) return 'correct-reveal';
    if (index === selectedIndex.value && index !== correctIndex.value) return 'wrong-reveal';
  }
  return '';
};

// --- Socket 監聽 ---

props.socket.on('gameStart', () => {
  status.value = 'playing';
  audio.bgm.play().catch(()=>{});
  // 遊戲開始後，啟動 Canvas
  setTimeout(initCanvas, 100); 
});

props.socket.on('newQuestion', (q) => {
  currentQuestion.value = q;
  phase.value = 'answering';
  hasAnswered.value = false;
  selectedIndex.value = -1;
  correctIndex.value = -1;
  battleLog.value = '';
});

// ⚔️ 收到戰鬥結果，觸發動畫
props.socket.on('roundResult', (result) => {
  phase.value = 'reveal';
  correctIndex.value = result.correctAnswer;
  playersList.value = result.players;
  battleLog.value = result.logMessage;

  // 1. 找出攻擊者和受害者
  // 邏輯：如果有造成傷害，代表有人攻擊成功
  if (result.damage > 0) {
      logType.value = (result.victimId === myId) ? 'danger' : 'success';
      
      // 播放音效
      if (result.victimId === myId) audio.hurt.play();
      else audio.attack.play();

      // 設定動畫狀態
      // 找出攻擊者 ID (不是受害者就是攻擊者)
      const attackerId = playersList.value.find(p => p.id !== result.victimId)?.id;
      
      if (attackerId && sprites.value[attackerId]) {
          sprites.value[attackerId].state = 'ATTACK';
          sprites.value[attackerId].frame = 0; // 重播動作
      }
      
      if (result.victimId && sprites.value[result.victimId]) {
           sprites.value[result.victimId].state = 'HURT';
           // 受傷可以做個簡單的位移或閃爍，這裡先不切動作行，用特效處理
      }
  } else {
      logType.value = 'info';
  }
});

props.socket.on('gameOver', (finalPlayers) => {
  playersList.value = finalPlayers;
  status.value = 'finished';
  audio.bgm.pause();
  cancelAnimationFrame(animationFrameId);
});

// --- 🎨 Canvas 動畫引擎 ---

function initCanvas() {
  if (!battleCanvas.value) return;
  ctx = battleCanvas.value.getContext('2d');
  ctx.imageSmoothingEnabled = false; // 像素風必備

  // 初始化每個玩家的精靈狀態
  // 左邊玩家 (P1)
  if (playersList.value[0]) {
      sprites.value[playersList.value[0].id] = {
          x: 150, y: 100, state: 'IDLE', frame: 0, frameTimer: 0, flip: false
      };
  }
  // 右邊玩家 (P2)
  if (playersList.value[1]) {
      sprites.value[playersList.value[1].id] = {
          x: 550, y: 100, state: 'IDLE', frame: 0, frameTimer: 0, flip: true // 翻轉面向左
      };
  }

  animate();
}

const ANIMATION_SPEED = 10; // 越小越快
const FRAMES_PER_ROW = 4;   // 假設一行有 4 格

function animate() {
  if (status.value !== 'playing') return;
  ctx.clearRect(0, 0, battleCanvas.value.width, battleCanvas.value.height);

  // 繪製地板 (簡單示意)
  ctx.fillStyle = '#222';
  ctx.fillRect(50, 250, 700, 10);

  // 繪製每個玩家
  playersList.value.forEach(player => {
      const sprite = sprites.value[player.id];
      if (!sprite) return;

      // 1. 決定要畫哪一行 (Row)
      let row = 0; // IDLE
      if (sprite.state === 'ATTACK') row = 1;
      
      // 2. 計算剪裁位置
      let sx = sprite.frame * SPRITE_W;
      let sy = row * SPRITE_H;

      // 3. 處理動畫幀更新
      sprite.frameTimer++;
      if (sprite.frameTimer > ANIMATION_SPEED) {
          sprite.frame++;
          sprite.frameTimer = 0;
          
          // 動作播完的處理
          if (sprite.frame >= FRAMES_PER_ROW) {
              if (sprite.state === 'ATTACK') {
                  sprite.state = 'IDLE'; // 攻擊完回歸待機
                  sprite.frame = 0;
              } else {
                  sprite.frame = 0; // IDLE 循環
              }
          }
      }

      // 4. 繪圖 (處理翻轉)
      ctx.save();
      if (sprite.flip) {
          // 水平翻轉
          ctx.translate(sprite.x + SPRITE_W * SCALE, sprite.y);
          ctx.scale(-1, 1);
          ctx.drawImage(spriteImg, sx, sy, SPRITE_W, SPRITE_H, 0, 0, SPRITE_W * SCALE, SPRITE_H * SCALE);
      } else {
          ctx.drawImage(spriteImg, sx, sy, SPRITE_W, SPRITE_H, sprite.x, sprite.y, SPRITE_W * SCALE, SPRITE_H * SCALE);
      }
      ctx.restore();
      
      // 5. 如果是受傷狀態，畫個紅光濾鏡 (選用)
      if (sprite.state === 'HURT') {
          // 簡單閃爍邏輯：過幾幀就切回 IDLE
          if (Math.random() > 0.5) {
               ctx.globalCompositeOperation = 'source-atop';
               ctx.fillStyle = 'rgba(255,0,0,0.5)';
               ctx.fillRect(sprite.x, sprite.y, SPRITE_W*SCALE, SPRITE_H*SCALE);
          }
          // 自動復原
          setTimeout(() => { if(sprite.state === 'HURT') sprite.state = 'IDLE'; }, 500);
      }
  });

  animationFrameId = requestAnimationFrame(animate);
}

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId);
});
</script>

<style scoped>
/* 戰鬥舞台 */
.battle-stage {
  position: relative;
  width: 100%;
  height: 300px; /* 畫布高度 */
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 15px;
  border: 2px solid #444;
  box-shadow: inset 0 0 20px #000;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* 血條 UI 層 */
.hud-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 讓點擊穿透到 Canvas */
  display: flex;
  justify-content: space-between;
  padding: 15px;
  box-sizing: border-box;
}

.hud-player {
  width: 200px;
}

.hud-name {
  color: #fff;
  font-weight: bold;
  margin-bottom: 5px;
  text-shadow: 1px 1px 2px #000;
}
.hud-name.me { color: #00ffea; }

.hp-bar-container {
  width: 100%;
  height: 12px;
  background: rgba(0,0,0,0.8);
  border: 1px solid #666;
  border-radius: 6px;
  overflow: hidden;
}

.hp-bar {
  height: 100%;
  transition: width 0.3s ease-out;
}

.hp-text {
  font-size: 10px;
  color: #ccc;
  text-align: right;
  margin-top: 2px;
}

/* 戰鬥文字 */
.battle-log-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 15px 25px;
  border-radius: 8px;
  font-size: 1.5rem;
  font-weight: 800;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  border: 2px solid #fff;
  z-index: 10;
}
.battle-log-popup.success { background: rgba(0, 100, 0, 0.9); color: #81c784; }
.battle-log-popup.danger { background: rgba(139, 0, 0, 0.9); color: #e57373; }
.battle-log-popup.info { background: rgba(0, 0, 0, 0.8); color: #fff; }

/* 進出場動畫 */
.pop-enter-active, .pop-leave-active { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.pop-enter-from { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
.pop-leave-to { transform: translate(-50%, -60%) scale(1.1); opacity: 0; }
</style>