import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDK-LwOv6BtWJAhUsj8lygT91Zz2RTYzgc",
  authDomain: "szc-store.firebaseapp.com",
  projectId: "szc-store",
  storageBucket: "szc-store.firebasestorage.app",
  messagingSenderId: "777209021202",
  appId: "1:777209021202:web:848df3f5af2074e4d5e9cb",
  measurementId: "G-0JL66D2KED"
};

export const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (_) { /* Analytics is optional. */ }
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, ref, uploadBytes, getDownloadURL
};
