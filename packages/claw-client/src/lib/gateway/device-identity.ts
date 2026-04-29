import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2";

// @noble/ed25519 v2 requires a SHA-512 implementation to be provided
ed.etc.sha512Sync = sha512;

const DB_NAME = "claw-db";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const KEY_NAME = "device-keypair-v1";

export interface DeviceIdentity {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  deviceId: string; // SHA-256 hex of raw public key
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadKeypair(
  db: IDBDatabase,
): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array } | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY_NAME);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveKeypair(
  db: IDBDatabase,
  keypair: { privateKey: Uint8Array; publicKey: Uint8Array },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(keypair, KEY_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const db = await openDb();
  let keypair = await loadKeypair(db);

  if (!keypair) {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKey(privateKey);
    keypair = { privateKey, publicKey };
    await saveKeypair(db, keypair);
  }

  const deviceId = toHex(sha256(keypair.publicKey));
  return { ...keypair, deviceId };
}

export async function signMessage(message: string, privateKey: Uint8Array): Promise<Uint8Array> {
  const msgBytes = new TextEncoder().encode(message);
  return ed.sign(msgBytes, privateKey);
}
