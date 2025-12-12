<template>
  <div class="profile-wrapper">
    <!-- 1. 常駐的設定按鈕 (只有這個會一直顯示) -->
    <button class="settings-toggle" @click="togglePanel" :class="{ active: isOpen }">
      <span class="icon">⚙️</span> SYSTEM
    </button>

    <!-- 2. 彈出式面板 (點擊按鈕後才會出現) -->
    <transition name="fade">
      <div v-if="isOpen" class="profile-panel">
        <div class="panel-header">USER PROFILE</div>
        
        <div class="avatar-section">
          <div class="avatar-frame">
            <img :src="photoURL || defaultAvatar" class="avatar-img" />
          </div>
        </div>

        <div class="user-info">
          <div class="display-name">{{ displayName }}</div>
          <div class="id-code">ID: {{ usernameId }}</div>
        </div>

        <button class="logout-btn" @click="logout">LOGOUT</button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const user = auth.currentUser;
const photoURL = ref(user?.photoURL);
const displayName = ref(user?.displayName || 'OPERATOR'); 
const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

// 控制面板開關的變數
const isOpen = ref(false);

const usernameId = computed(() => {
  if (user?.email) {
    return user.email.replace('@cyber.net', '');
  }
  return 'GUEST';
});

// 切換開關
const togglePanel = () => {
  isOpen.value = !isOpen.value;
};

const logout = () => signOut(auth);
</script>

<style scoped>
/* 樣式已移至 userprofile.css，這裡保持空白即可 */
</style>