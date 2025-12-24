import CryptoJS from "crypto-js";

const SECRET = import.meta.env.VITE_TOKEN_SECRET || process.env.TOKEN_SECRET;

if (!SECRET) {
  throw new Error("Missing TOKEN_SECRET env variable");
}

export function encryptToken(token: string): string {
  return CryptoJS.AES.encrypt(token, SECRET).toString();
}

export function decryptToken(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  if (!decrypted) {
    throw new Error("Failed to decrypt token");
  }

  return decrypted;
}
