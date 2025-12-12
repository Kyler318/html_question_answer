<template>
  <div class="auth-container">
    <div class="cyber-box auth-box">
      <div class="header">
        <h3>{{ isLogin ? 'SYSTEM ACCESS' : 'NEW REGISTRATION' }}</h3>
        <div class="scan-line"></div>
      </div>

      <div class="form-group">
        <label>LOGIN ID (UNIQUE)</label>
        <input 
          type="text" 
          v-model="username" 
          placeholder="ENTER ID..." 
          maxlength="15"
          @input="filterInput"
        >
      </div>

      <!-- 新增：暱稱輸入框 (只在註冊時顯示) -->
      <div class="form-group" v-if="!isLogin">
        <label>DISPLAY NAME (NICKNAME)</label>
        <input 
          type="text" 
          v-model="nickname" 
          placeholder="ENTER NICKNAME..." 
          maxlength="12"
        >
      </div>

      <div class="form-group">
        <label>PASSWORD</label>
        <input type="password" v-model="password" placeholder="******">
      </div>

      <div class="error-msg" v-if="errorMsg">{{ errorMsg }}</div>

      <button class="mode-btn" @click="handleAuth">
        <div class="glitch-text">{{ isLogin ? 'LOGIN' : 'REGISTER' }}</div>
      </button>

      <div class="toggle-mode" @click="toggleMode">
        {{ isLogin ? 'CREATE NEW ACCOUNT' : 'BACK TO LOGIN' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { auth } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile // 引入更新個人資料的方法
} from 'firebase/auth';

const username = ref('');
const password = ref('');
const nickname = ref(''); // 新增暱稱變數
const isLogin = ref(true);
const errorMsg = ref('');

const FAKE_DOMAIN = '@cyber.net';

const toggleMode = () => {
  isLogin.value = !isLogin.value;
  errorMsg.value = '';
  nickname.value = ''; // 切換模式時清空暱稱
};

const filterInput = () => {
  username.value = username.value.replace(/[^a-zA-Z0-9]/g, '');
};

const handleAuth = async () => {
  errorMsg.value = '';
  
  if (!username.value || username.value.length < 3) {
    errorMsg.value = '帳號長度需大於 3 字元';
    return;
  }

  // 註冊時檢查暱稱
  if (!isLogin.value && !nickname.value) {
    errorMsg.value = '請輸入您的暱稱';
    return;
  }

  const emailFormat = username.value + FAKE_DOMAIN;

  try {
    if (isLogin.value) {
      // 登入
      await signInWithEmailAndPassword(auth, emailFormat, password.value);
    } else {
      // 註冊流程：
      // 1. 建立帳號
      const userCredential = await createUserWithEmailAndPassword(auth, emailFormat, password.value);
      
      // 2. 立即寫入暱稱 (displayName)
      await updateProfile(userCredential.user, {
        displayName: nickname.value
      });
      
      // 3. 強制重新整理頁面以確保 App 抓到最新的 displayName (最簡單的解法)
      location.reload();
    }
  } catch (err) {
    console.error(err);
    switch(err.code) {
      case 'auth/invalid-email': errorMsg.value = '帳號格式錯誤'; break;
      case 'auth/email-already-in-use': errorMsg.value = '此帳號已被註冊'; break;
      case 'auth/weak-password': errorMsg.value = '密碼需 6 位以上'; break;
      case 'auth/wrong-password': errorMsg.value = '密碼錯誤'; break;
      case 'auth/user-not-found': errorMsg.value = '找不到此帳號'; break;
      default: errorMsg.value = err.message;
    }
  }
};
</script>