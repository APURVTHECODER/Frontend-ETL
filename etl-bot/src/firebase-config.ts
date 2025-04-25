// src/firebase-config.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration from the Firebase console
// Use environment variables for sensitive keys in real apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Optional
};

// Initialize Firebase
let app: FirebaseApp;
try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App Initialized");
} catch (error) {
    console.error("Error initializing Firebase App:", error);
    // Handle initialization error appropriately, maybe show error message
    // For now, we'll throw it so it's visible during development
    throw new Error("Firebase initialization failed");
}


// Get Auth instance
const auth: Auth = getAuth(app);

// Create Google Provider instance
const googleProvider = new GoogleAuthProvider();
// Optional: Add custom parameters or scopes if needed
// googleProvider.addScope('https://www.googleapis.com/auth/contacts.readonly');
// googleProvider.setCustomParameters({
//   'login_hint': 'user@example.com'
// });

export { app, auth, googleProvider };