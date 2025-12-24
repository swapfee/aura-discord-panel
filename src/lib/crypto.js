import CryptoJS from "crypto-js";

const SECRET = process.env.CRYPTO_SECRET;
if (!SECRET) {
  throw new Error("Missing CRYPTO_SECRET");
}

export function encrypt(text) {
  return CryptoJS.AES.encrypt(text, SECRET).toString();
}

export function decrypt(ciphertext) {
  return CryptoJS.AES.decrypt(ciphertext, SECRET).toString(CryptoJS.enc.Utf8);
}
