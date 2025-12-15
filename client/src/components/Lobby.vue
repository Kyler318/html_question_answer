<template>
  <div class="lobby-container">
    <div class="cyber-box">
      <div class="header">
        <div class="scan-line"></div>
        <h3>{{ getTitle() }}</h3>
      </div>

      <div class="form-group" v-if="step === 1">
        <label>CODENAME</label>
        <input v-model="playerName" placeholder="ENTER NAME..." maxlength="8" />
        <button class="mode-btn next-btn" @click="step = 2" :disabled="!playerName">
          NEXT STEP
        </button>
      </div>

      <div class="mode-group" v-if="step === 2">
        <label>SELECT SUBJECT</label>
        <div class="grid-btns">
          <button class="mode-btn subject-btn" @click="chooseSubject('microbit')">
            Micro:bit
          </button>
          <button class="mode-btn subject-btn" @click="chooseSubject('python')">
            Python
          </button>
          <button class="mode-btn subject-btn" @click="chooseSubject('html')">
            HTML/CSS
          </button>
          <button class="mode-btn subject-btn brain" @click="chooseSubject('brain')">
            腦筋急轉彎
          </button>
        </div>
        <button class="mode-btn back" @click="step = 1" style="margin-top:10px">BACK</button>
      </div>

      <div class="mode-group" v-if="step === 3">
        <div class="selected-info">SUBJECT: {{ subjectName }}</div>
        <label>SELECT PLAYERS</label>
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
        <button class="mode-btn back" @click="step = 2" style="margin-top:10px">BACK</button>
      </div>

      <div class="action-group" v-if="step === 4">
        <div class="selected-info">{{ subjectName }} / {{ selectedMode }}P</div>
        
        <div class="grid-btns">
          <button class="mode-btn create" @click="handleCreate">
            <div class="glitch-text">CREATE ROOM</div>
            <div class="sub">GENERATE NEW ID</div>
          </button>

          <button class="mode-btn join" @click="step = 5">
            <div class="glitch-text">JOIN ROOM</div>
            <div class="sub">ENTER ROOM ID</div>
          </button>
        </div>
        <button class="mode-btn back" @click="step = 3" style="margin-top:10px">BACK</button>
      </div>

      <div class="input-group" v-if="step === 5">
        <label>ENTER ROOM ID</label>
        <input v-model="inputRoomId" type="text" placeholder="0000" maxlength="4" class="room-input"/>
        
        <div class="grid-btns">
          <button class="mode-btn confirm" @click="handleJoin">CONNECT</button>
          <button class="mode-btn back" @click="step = 4">BACK</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps(['user']);
const emit = defineEmits(['create', 'join']);

const playerName = ref('');
const step = ref(1);
const selectedMode = ref(0);
const selectedSubject = ref('html');
const inputRoomId = ref('');

// 自動填入名字
if (props.user) {
  if (props.user.displayName) playerName.value = props.user.displayName;
  else if (props.user.email) playerName.value = props.user.email.replace('@cyber.net', '').toUpperCase();
}

const getTitle = () => {
    if (step.value === 1) return 'IDENTITY LOGIN';
    if (step.value === 2) return 'SELECT SUBJECT';
    if (step.value === 3) return 'SELECT PROTOCOL';
    if (step.value === 4) return 'SELECT ACTION';
    return 'SYSTEM';
}

const subjectName = computed(() => {
  const map = { microbit: 'Micro:bit', python: 'Python', html: 'HTML/CSS', brain: 'Brain Teasers' };
  return map[selectedSubject.value] || selectedSubject.value;
});

const chooseSubject = (sub) => {
  selectedSubject.value = sub;
  step.value = 3;
};

const chooseMode = (mode) => {
  selectedMode.value = mode;
  step.value = 4;
};

const handleCreate = () => {
  emit('create', { 
    mode: selectedMode.value, 
    subject: selectedSubject.value, // 傳送科目給後端
    playerName: playerName.value 
  });
};

const handleJoin = () => {
  if (!inputRoomId.value || inputRoomId.value.length !== 4) {
    alert('請輸入 4 位數房間號碼');
    return;
  }
  emit('join', { 
    roomId: inputRoomId.value, 
    playerName: playerName.value 
  });
};
</script>