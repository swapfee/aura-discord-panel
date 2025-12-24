import CryptoJS from "crypto-js";

const SECRET = process.env.TOKEN_ENC_SECRET;

if (!SECRET) {
  throw new Error("Missing TOKEN_ENC_SECRET");
}

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET).toString();
}

export function decrypt(cipher: string): string {
  const bytes = CryptoJS.AES.decrypt(cipher, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
