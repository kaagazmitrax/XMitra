import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCrt5RuCmQ020GJrYbj8TBi5TqL0DMIHRA", // Paste your values here
  authDomain: "kaagazmitra-backend.firebaseapp.com",
  projectId: "kaagazmitra-backend",
  storageBucket: "kaagazmitra-backend.firebasestorage.app",
  messagingSenderId: "1076036515414",
  appId: "1:1076036515414:web:c2f020bc46b7dea9652df7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);