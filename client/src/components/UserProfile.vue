<template>
  <div class="profile-panel">
    <div class="avatar-section">
      <div class="avatar-frame">
        <!-- 顯示圖片，如果沒有就顯示預設圖 -->
        <img :src="photoURL || defaultAvatar" class="avatar-img" />
      </div>
      
      <label class="upload-btn">
        UPLOAD PHOTO
        <!-- 限制只能選圖片 -->
        <input type="file" @change="uploadAvatar" accept="image/*" hidden>
      </label>
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
// ❌ 刪除這行：不需要 storage 了
// import { storage } from '../firebase'; 
// ❌ 刪除這行：不需要 storage 的函式
// import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { updateProfile, signOut } from 'firebase/auth';

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

// ✅ 新的轉檔上傳邏輯
const uploadAvatar = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // ⚠️ 限制檔案大小：因為是轉成文字，太大會導致資料庫塞不下
  // 這裡限制 150KB (對於小頭像來說非常夠用了)
  if (file.size > 150 * 1024) {
    alert('圖片太大了！請使用 150KB 以下的小圖片');
    return;
  }

  // 使用瀏覽器內建的 FileReader
  const reader = new FileReader();
  
  // 讀取成功後執行
  reader.onload = async (e) => {
    const base64String = e.target.result; // 這就是圖片的編碼字串
    
    try {
      // 直接把這串「圖片文字」存入使用者的 photoURL 欄位
      await updateProfile(user, { photoURL: base64String });
      
      // 更新畫面
      photoURL.value = base64String;
      alert('AVATAR UPDATED SUCCESS!');
    } catch (err) {
      console.error(err);
      alert('UPDATE FAILED: ' + err.message);
    }
  };

  // 開始讀取檔案，並轉為 Data URL (Base64)
  reader.readAsDataURL(file);
};

const logout = () => signOut(auth);
</script>