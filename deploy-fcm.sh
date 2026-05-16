#!/bin/bash

# FCM Deployment Script for ProCollab
# This script sets up and deploys Firebase Cloud Functions for FCM

echo "🚀 ProCollab FCM Deployment Script"
echo "=================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in to Firebase
echo "🔐 Checking Firebase authentication..."
firebase login --no-localhost

# Set the Firebase project
echo "📋 Setting Firebase project to projectmap-f1155..."
firebase use projectmap-f1155

# Install function dependencies
echo "📦 Installing Cloud Function dependencies..."
cd functions
npm install
cd ..

# Build functions
echo "🔨 Building Cloud Functions..."
cd functions
npm run build
cd ..

# Deploy functions only
echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions

# Deploy Firestore rules and indexes
echo "🔒 Deploying Firestore rules and indexes..."
firebase deploy --only firestore

echo ""
echo "✅ FCM Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Get your VAPID key from Firebase Console:"
echo "   → Go to https://console.firebase.google.com/project/projectmap-f1155/settings/cloudmessaging"
echo "   → Copy the VAPID key from 'Web Push certificates'"
echo "   → Add it to your .env file as VITE_FIREBASE_VAPID_KEY=your_key_here"
echo ""
echo "2. Test FCM functionality:"
echo "   → Restart your development server"
echo "   → Check browser console for FCM registration"
echo "   → Test notifications in the app"
echo ""
echo "3. Monitor Cloud Functions:"
echo "   → firebase functions:log --only processFCMQueue"
echo ""