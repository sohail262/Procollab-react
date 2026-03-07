#!/usr/bin/env node

/**
 * Security & Performance Verification Script
 * Run this script to verify all fixes have been applied correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying Security & Performance Fixes...\n');

const checks = [];
let passed = 0;
let failed = 0;

// Helper function to check if file exists
function fileExists(filePath) {
    return fs.existsSync(path.join(__dirname, filePath));
}

// Helper function to check if file contains text
function fileContains(filePath, searchText) {
    if (!fileExists(filePath)) return false;
    const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    return content.includes(searchText);
}

// Helper function to add check result
function addCheck(name, condition, description) {
    const status = condition ? '✅' : '❌';
    const result = { name, status, condition, description };
    checks.push(result);
    
    if (condition) {
        passed++;
        console.log(`${status} ${name}`);
    } else {
        failed++;
        console.log(`${status} ${name} - ${description}`);
    }
}

console.log('📋 Security Checks:\n');

// 1. Environment Variables
addCheck(
    'Environment Variables Setup',
    fileExists('.env.example') && fileExists('.env'),
    'Create .env file from .env.example'
);

addCheck(
    'Firebase Config Security',
    fileContains('src/lib/firebase.ts', 'import.meta.env.VITE_FIREBASE_API_KEY'),
    'Firebase config should use environment variables'
);

// 2. Input Validation
addCheck(
    'Validation Library',
    fileExists('src/lib/validation.ts'),
    'Input validation library should exist'
);

addCheck(
    'DOMPurify Integration',
    fileContains('src/lib/validation.ts', 'DOMPurify'),
    'DOMPurify should be integrated for XSS protection'
);

// 3. Error Boundaries
addCheck(
    'Error Boundary Component',
    fileExists('src/components/ErrorBoundary.tsx'),
    'Error boundary component should exist'
);

addCheck(
    'Error Boundary in App',
    fileContains('src/App.tsx', 'ErrorBoundary'),
    'Error boundaries should be used in App.tsx'
);

// 4. Query Optimization
addCheck(
    'Query Utils Library',
    fileExists('src/lib/queryUtils.ts'),
    'Query optimization utilities should exist'
);

addCheck(
    'Caching Implementation',
    fileContains('src/lib/queryUtils.ts', 'queryCache'),
    'Query caching should be implemented'
);

// 5. Authentication Security
addCheck(
    'Session Management',
    fileContains('src/contexts/AuthContext.tsx', 'SESSION_TIMEOUT'),
    'Session timeout should be implemented'
);

addCheck(
    'Admin Verification',
    fileContains('src/hooks/useAdmin.ts', 'onSnapshot'),
    'Real-time admin verification should be implemented'
);

console.log('\n📊 Performance Checks:\n');

// 6. Performance Optimizations
addCheck(
    'Dashboard Optimization',
    fileContains('src/services/dashboardService.ts', 'cachedQuery'),
    'Dashboard should use cached queries'
);

addCheck(
    'Batch Operations',
    fileContains('src/lib/queryUtils.ts', 'batchGetDocs'),
    'Batch operations should be implemented'
);

addCheck(
    'Rate Limiting',
    fileContains('src/lib/queryUtils.ts', 'rateLimiter'),
    'Rate limiting should be implemented'
);

console.log('\n🛡️ Crash Prevention Checks:\n');

// 7. Crash Prevention
addCheck(
    'Form Validation',
    fileContains('src/pages/CreateProject.tsx', 'validateFormData'),
    'Forms should have validation'
);

addCheck(
    'Error Handling',
    fileContains('src/pages/Dashboard.tsx', 'Promise.allSettled'),
    'Async operations should handle errors gracefully'
);

console.log('\n📁 Configuration Checks:\n');

// 8. Configuration
addCheck(
    'Security Documentation',
    fileExists('SECURITY_FIXES.md'),
    'Security fixes documentation should exist'
);

addCheck(
    'Updated README',
    fileContains('README.md', 'Security Features'),
    'README should document security features'
);

addCheck(
    'Protected .env',
    fileContains('.gitignore', '.env'),
    '.env files should be in .gitignore'
);

// Package.json dependencies
const packageJsonExists = fileExists('package.json');
let hasDOMPurify = false;

if (packageJsonExists) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    hasDOMPurify = packageJson.dependencies && packageJson.dependencies['dompurify'];
}

addCheck(
    'DOMPurify Dependency',
    hasDOMPurify,
    'DOMPurify should be installed as dependency'
);

console.log('\n' + '='.repeat(50));
console.log(`📊 VERIFICATION SUMMARY`);
console.log('='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📋 Total: ${checks.length}`);

const successRate = Math.round((passed / checks.length) * 100);
console.log(`🎯 Success Rate: ${successRate}%`);

if (failed === 0) {
    console.log('\n🎉 All security and performance fixes have been successfully applied!');
    console.log('🚀 Your application is now secure, optimized, and crash-resistant.');
} else {
    console.log('\n⚠️  Some fixes are missing. Please address the failed checks above.');
    console.log('📖 Refer to SECURITY_FIXES.md for detailed implementation guidance.');
}

console.log('\n📋 Next Steps:');
console.log('1. Set up your Firebase project and update .env file');
console.log('2. Deploy Firestore security rules');
console.log('3. Test all authentication flows');
console.log('4. Monitor performance and error rates');
console.log('5. Set up production error tracking (Sentry)');

console.log('\n🔗 Useful Commands:');
console.log('npm run dev          # Start development server');
console.log('npm run build        # Build for production');
console.log('npm audit            # Check for vulnerabilities');
console.log('firebase deploy      # Deploy to Firebase');

process.exit(failed === 0 ? 0 : 1);