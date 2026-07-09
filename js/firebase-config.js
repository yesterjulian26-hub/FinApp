const firebaseConfig = {
  apiKey: "AIzaSyCnmu6j0GZejzPneVl7-8pJMamqP0Jdnmc",
  authDomain: "finapp-499619.firebaseapp.com",
  projectId: "finapp-499619",
  storageBucket: "finapp-499619.firebasestorage.app",
  messagingSenderId: "879966880858",
  appId: "1:879966880858:web:8fb08527d0bf61d6e18463"
};

/* global firebase */
firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleProvider = new firebase.auth.GoogleAuthProvider();

// Auth helpers
export function onAuthChange(callback) {
  return auth.onAuthStateChanged(callback);
}

export async function signInWithGoogle() {
  try {
    await auth.signInWithPopup(googleProvider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      await auth.signInWithRedirect(googleProvider);
    } else {
      throw err;
    }
  }
}

export function signOut() {
  return auth.signOut();
}

export function currentUser() {
  return auth.currentUser;
}
