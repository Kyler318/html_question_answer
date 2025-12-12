<template>
  <div class="profile-panel">
    <div class="avatar-section">
      <div class="avatar-frame">
        <img :src="photoURL || defaultAvatar" class="avatar-img" />
      </div>
      <!-- ❌ 移除了上傳按鈕 -->
    </div>

    <div class="user-info">
      <div class="display-name">{{ displayName }}</div>
      <div class="id-code">ID: {{ usernameId }}</div>
    </div>

    <button class="logout-btn" @click="logout">LOGOUT</button>
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

const usernameId = computed(() => {
  if (user?.email) {
    return user.email.replace('@cyber.net', '');
  }
  return 'GUEST';
});

const logout = () => signOut(auth);
</script>

<style scoped>
/* 樣式簡化，移除 upload-btn 相關 */
/* 其他保持不變 */
</style>