// Firebase başlatma ve Realtime Database yardımcıları.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, update, get, remove,
  onValue, onDisconnect, serverTimestamp, child,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// Config doldurulmuş mu? (placeholder değerler kalmışsa uyaralım)
export const isConfigured =
  firebaseConfig &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes("BURAYA") &&
  firebaseConfig.databaseURL &&
  !firebaseConfig.databaseURL.includes("BURAYA");

let db = null;
if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export {
  db, ref, set, update, get, remove,
  onValue, onDisconnect, serverTimestamp, child,
};
