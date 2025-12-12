// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDBUImEHJh2V_kblqlOVgKICjUP_P02gcc",
    authDomain: "projectmap-f1155.firebaseapp.com",
    databaseURL: "https://projectmap-f1155-default-rtdb.firebaseio.com",
    projectId: "projectmap-f1155",
    storageBucket: "projectmap-f1155.firebasestorage.app",
    messagingSenderId: "907011304023",
    appId: "1:907011304023:web:3b0a3b22b6ace96fdc9112",
    measurementId: "G-45SKG36DW1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const database = getDatabase(app);

export default app;
