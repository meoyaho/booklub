// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
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
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

const booksCol = collection(db, 'books');
const analyzeRecordingCallable = httpsCallable(functions, 'analyzeRecording');

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

export async function deleteBook(bookId) {
  await deleteDoc(doc(db, 'books', bookId));
}

function getAudioExtension(file) {
  const nameExtension = file?.name?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension;

  const typeExtension = {
    'audio/flac': 'flac',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  }[file?.type];

  return typeExtension || 'webm';
}

export async function uploadRecording(bookId, file) {
  const extension = getAudioExtension(file);
  const contentType = file?.type || 'audio/webm';
  const path = `recordings/${bookId}/${Date.now()}.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType });
  const url = await getDownloadURL(storageRef);
  return { url, path, contentType };
}

export async function analyzeRecording(data) {
  const result = await analyzeRecordingCallable(data);
  return result.data;
}
