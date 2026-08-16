// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

const booksCol = collection(db, 'books');

export function subscribeBooks(callback) {
  const q = query(booksCol, orderBy('addedAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(books);
  });
}

export async function addBook(data) {
  const docRef = await addDoc(booksCol, {
    ...data,
    status: 'pending',
    addedAt: serverTimestamp(),
    reviews: [],
  });
  return docRef.id;
}

export async function updateBook(bookId, data) {
  await updateDoc(doc(db, 'books', bookId), data);
}

export async function uploadRecording(bookId, blob) {
  const path = `recordings/${bookId}/${Date.now()}.webm`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
