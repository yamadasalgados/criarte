import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./firebaseClient";

export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function logout() {
  await signOut(auth);
}
