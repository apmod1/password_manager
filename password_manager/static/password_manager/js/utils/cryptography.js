
/**
 * Cryptography utility functions for the password manager
 */

// Convert string to UTF-8 array
function strToUTF8Arr(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Convert UTF-8 array to string
function UTF8ArrToStr(array) {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(array);
}

// Base64 utilities
function base64EncArr(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}

function base64DecToArr(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Key derivation function using PBKDF2 (fallback for Argon2id)
async function deriveMasterKey(password, salt, iterations = 600000) {
  // Convert inputs to appropriate formats
  const passwordBuffer = typeof password === 'string' ? strToUTF8Arr(password) : password;
  const saltBuffer = typeof salt === 'string' ? strToUTF8Arr(salt) : salt;
  
  // Import password as key material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive key with high iteration count
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// Generate wrapped key for secure storage
async function generateWrappedKey(password, uuid, username) {
  // Create salt from username hash and UUID
  const usernameHash = await sha512(username);
  const uuidBytes = strToUTF8Arr(uuid.replace(/-/g, ''));
  
  // Concatenate for salt
  const salt = new Uint8Array(usernameHash.length + uuidBytes.length);
  salt.set(new Uint8Array(usernameHash), 0);
  salt.set(uuidBytes, usernameHash.length);
  
  // Derive the key wrapping key
  const aesKwKey = await deriveMasterKey(password, salt);
  
  // Generate a new AES-GCM key to be wrapped
  const keyToWrap = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Wrap the key for secure storage
  const wrappedKey = await window.crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    aesKwKey,
    'AES-KW'
  );
  
  return {
    wrappedKey: wrappedKey,
    algorithm: 'aesgcm',
    exportedKeyToWrap: await window.crypto.subtle.exportKey('raw', keyToWrap)
  };
}

// Unwrap a key for use
async function unwrapKey(wrappedKey, password, uuid, username) {
  // Create salt from username hash and UUID (same as in wrap)
  const usernameHash = await sha512(username);
  const uuidBytes = strToUTF8Arr(uuid.replace(/-/g, ''));
  
  // Concatenate for salt
  const salt = new Uint8Array(usernameHash.length + uuidBytes.length);
  salt.set(new Uint8Array(usernameHash), 0);
  salt.set(uuidBytes, usernameHash.length);
  
  // Derive the key wrapping key
  const aesKwKey = await deriveMasterKey(password, salt);
  
  // Unwrap the key
  return window.crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    aesKwKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// SHA-512 hash function
async function sha512(message) {
  const msgBuffer = typeof message === 'string' ? strToUTF8Arr(message) : message;
  return window.crypto.subtle.digest('SHA-512', msgBuffer);
}

// Generate HMAC
async function generateHMAC(key, data) {
  const keyBuffer = typeof key === 'string' ? strToUTF8Arr(key) : key;
  const dataBuffer = typeof data === 'string' ? strToUTF8Arr(data) : data;
  
  const hmacKey = await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  
  return window.crypto.subtle.sign('HMAC', hmacKey, dataBuffer);
}

// Encrypt data with AES-GCM
async function encryptData(key, data, aad = null) {
  // Generate random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Convert inputs if needed
  const dataBuffer = typeof data === 'string' ? strToUTF8Arr(data) : data;
  const aadBuffer = aad ? (typeof aad === 'string' ? strToUTF8Arr(aad) : aad) : null;
  
  // Encrypt
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      additionalData: aadBuffer,
      tagLength: 128
    },
    key,
    dataBuffer
  );
  
  // Concatenate IV and ciphertext
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return result;
}

// Decrypt data with AES-GCM
async function decryptData(key, encryptedData, aad = null) {
  // Extract IV (first 12 bytes)
  const iv = encryptedData.slice(0, 12);
  
  // Extract ciphertext
  const ciphertext = encryptedData.slice(12);
  
  // Convert AAD if needed
  const aadBuffer = aad ? (typeof aad === 'string' ? strToUTF8Arr(aad) : aad) : null;
  
  // Decrypt
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: aadBuffer,
        tagLength: 128
      },
      key,
      ciphertext
    );
    
    return new Uint8Array(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed. Invalid key or corrupted data.');
  }
}

// IndexedDB functions for local storage
const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

async function openVaultDatabase() {
  return new Promise((resolve, reject) => {
    if (!indexedDB) {
      reject(new Error('IndexedDB not supported by this browser'));
      return;
    }
    
    const request = indexedDB.open('SecureVault', 1);
    
    request.onerror = (event) => {
      reject(new Error('Error opening IndexedDB'));
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Create object stores
      if (!db.objectStoreNames.contains('vaultItems')) {
        db.createObjectStore('vaultItems', { keyPath: 'id' });
      }
    };
  });
}

async function storeVaultItem(item) {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vaultItems'], 'readwrite');
    const store = transaction.objectStore('vaultItems');
    const request = store.put(item);
    
    request.onerror = () => {
      reject(new Error('Error storing item in IndexedDB'));
    };
    
    request.onsuccess = () => {
      resolve(item);
    };
  });
}

async function getVaultItems() {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vaultItems'], 'readonly');
    const store = transaction.objectStore('vaultItems');
    const request = store.getAll();
    
    request.onerror = () => {
      reject(new Error('Error retrieving items from IndexedDB'));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function deleteVaultItem(id) {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vaultItems'], 'readwrite');
    const store = transaction.objectStore('vaultItems');
    const request = store.delete(id);
    
    request.onerror = () => {
      reject(new Error('Error deleting item from IndexedDB'));
    };
    
    request.onsuccess = () => {
      resolve(id);
    };
  });
}

// Export all cryptography functions
window.cryptoUtils = {
  strToUTF8Arr,
  UTF8ArrToStr,
  base64EncArr,
  base64DecToArr,
  deriveMasterKey,
  generateWrappedKey,
  unwrapKey,
  sha512,
  generateHMAC,
  encryptData,
  decryptData,
  openVaultDatabase,
  storeVaultItem,
  getVaultItems,
  deleteVaultItem
};
