import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

const targetUid = "2l81qAJ0GrP8yLZGbLF2pU5SPdj2";

async function check() {
  console.log("Fetching user profile for UID:", targetUid);
  
  const userDoc = await getDoc(doc(db, 'users', targetUid));
  if (!userDoc.exists()) {
    console.log("User doc not found!");
    return;
  }
  
  const data = userDoc.data();
  console.log("\nUser Document Data:");
  console.log("-------------------");
  console.log("First Name:  ", data.firstName);
  console.log("Last Name:   ", data.lastName);
  console.log("Email:       ", data.email);
  console.log("Discipline:  ", data.discipline);
  console.log("Role:        ", data.role);
  console.log("Skills field type:", typeof data.skills);
  console.log("Skills field isArray:", Array.isArray(data.skills));
  console.log("Skills:      ", JSON.stringify(data.skills));
  console.log("-------------------");
}

check().catch(console.error);
