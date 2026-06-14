import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
  console.log("Connecting to Firebase Project:", firebaseConfig.projectId);
  
  const snap = await getDocs(collection(db, 'projects'));
  console.log(`\nFound ${snap.size} projects in total:\n`);
  
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- Title: "${data.title}"`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  CreatedBy (UID): ${data.createdBy}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Tags: ${JSON.stringify(data.tags || [])}`);
    console.log(`  RequiredSkills: ${JSON.stringify(data.requiredSkills || [])}`);
    console.log(`  -----------------------------------------`);
  });
}

check().catch(console.error);
