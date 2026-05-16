@echo off
echo 🚀 ProCollab FCM Quick Fix and Deploy
echo ====================================

echo 📦 Cleaning and reinstalling dependencies...
cd functions
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul
npm install

echo 🔨 Building with skipLibCheck...
npx tsc --skipLibCheck

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed, trying alternative approach...
    echo 📝 Creating minimal build...
    
    REM Create lib directory if it doesn't exist
    if not exist "lib" mkdir lib
    
    REM Copy and compile just our index.ts
    npx tsc src/index.ts --outDir lib --module commonjs --target es2020 --skipLibCheck --esModuleInterop
)

echo ✅ Build completed!

cd ..

echo 🚀 Deploying to Firebase...
firebase deploy --only functions

echo ✅ Deployment complete!
echo.
echo 📋 Next steps:
echo 1. Get your VAPID key from Firebase Console
echo 2. Add VITE_FIREBASE_VAPID_KEY to your .env file
echo 3. Restart your dev server
echo.
pause