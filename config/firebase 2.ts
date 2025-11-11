// Firebase Configuration for AquaBuddy
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDVJgj8QJjiGzy3EGD3mwQ7ELw45rwrLXw",
  authDomain: "aquabuddy-001.firebaseapp.com",
  projectId: "aquabuddy-001",
  storageBucket: "aquabuddy-001.firebasestorage.app",
  messagingSenderId: "303921511341",
  appId: "1:303921511341:web:b4077cea67779293597f24",
  measurementId: "G-VFYV3E7E2E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
