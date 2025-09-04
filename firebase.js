// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC1TYFkw21WDolIBmlciwY9Xstk2OhjcP4",
  authDomain: "thought-offerings.firebaseapp.com",
  projectId: "thought-offerings",
  storageBucket: "thought-offerings.firebasestorage.app",
  messagingSenderId: "65092445033",
  appId: "1:65092445033:web:a6a6ec284f93b2f825d3f8",
  measurementId: "G-XH8VNZ9NRB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics and Firestore (only in browser environment)
let analytics = null;
let db = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
  db = getFirestore(app);
}

export { analytics, db };
