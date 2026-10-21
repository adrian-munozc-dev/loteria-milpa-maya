// Conexión a Firebase (Realtime Database + inicio de sesión anónimo).
// Estos valores son públicos por diseño; la seguridad la dan las reglas de database.rules.json.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set, update, remove, onValue, onDisconnect, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCD-jNpeBpJFIffSjSIznZPOEAo_LdT2Js',
  authDomain: 'lot-maya.firebaseapp.com',
  databaseURL: 'https://lot-maya-default-rtdb.firebaseio.com',
  projectId: 'lot-maya',
  storageBucket: 'lot-maya.firebasestorage.app',
  messagingSenderId: '586344994052',
  appId: '1:586344994052:web:77af962095679d43aeac51',
};

// Cada rol usa su propia "app" para que anfitrión y jugador tengan identidades distintas aunque compartan navegador.
export async function conectar(nombre) {
  const app = initializeApp(firebaseConfig, nombre);
  const auth = getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return { db: getDatabase(app), uid: auth.currentUser.uid };
}

export { ref, get, set, update, remove, onValue, onDisconnect, serverTimestamp };
