import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// 👇 這裡必須是你自己的真實數據，不能是 "你的API_KEY"
const firebaseConfig = {
  apiKey: "AIzaSyCJT_deZ5AeiAcBLYZvbilHuzx4b0DqkXI",
  authDomain: "gameauthentication-b94c3.firebaseapp.com",
  projectId: "gameauthentication-b94c3",
  storageBucket: "gameauthentication-b94c3.firebasestorage.app",
  messagingSenderId: "961065124478",
  appId: "1:961065124478:web:975c45c63e8c049a91ce2f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);