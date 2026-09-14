// Unambiguous alphabet: no O/0, l/1/I. These passwords get read aloud or typed
// from a note by the person they belong to, so characters that look alike cost
// a support call.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";

/** 16 characters, comfortably over the backend's 12-character minimum. */
export function generatePassword(length = 16): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  // Modulo bias across a 62-character alphabet is negligible at this length and
  // this is an admin-set temporary password, not a long-lived secret.
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join("");
}
