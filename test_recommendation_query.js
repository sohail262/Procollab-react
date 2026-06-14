import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    if (key) env[key] = val;
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("Running orderBy('createdAt', 'desc') query...");
  
  try {
    const q = query(
      collection(db, 'projects'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    
    const snap = await getDocs(q);
    console.log(`Query succeeded. Found ${snap.size} projects:`);
    console.log("-------------------");
    
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`- Title: "${data.title}"`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  CreatedBy: ${data.createdBy}`);
      console.log(`  CreatedAt exists: ${!!data.createdAt}`);
      if (data.createdAt) {
        console.log(`  CreatedAt val:`, data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt);
      }
      console.log(`  Status: ${data.status}`);
      console.log(`  -----------------------------------------`);
    });
  } catch (error) {
    console.error("Query failed with error:", error);
  }
}

check().catch(console.error);
