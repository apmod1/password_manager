document.addEventListener('DOMContentLoaded', function () {
    // If we're on the initial registration page, redirect to the proper endpoint
    if (window.location.pathname.includes('register') ||
        window.location.pathname.includes('create_user')) {
        window.location.href = '/password_manager/initial-registration/';
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // Copy UUID to clipboard
    document.getElementById('copy-uuid').addEventListener('click', function () {
        const uuid = document.getElementById('uuid-display').textContent;
        navigator.clipboard.writeText(uuid).then(() => {
            alert('UUID copied to clipboard');
        });
    });

    // Copy words to clipboard
    document.getElementById('copy-words').addEventListener('click', function () {
        const words = Array.from(document.querySelectorAll('#word-list li'))
            .map(li => li.textContent.trim())
            .join(' ');
        navigator.clipboard.writeText(words).then(() => {
            alert('Words copied to clipboard');
        });
    });

    // Handle TOTP verification
    document.getElementById('verify-totp').addEventListener('click', function () {
        const totpCode = document.getElementById('totp-input').value.trim();
        if (!totpCode || totpCode.length !== 6) {
            alert('Please enter a valid 6-digit TOTP code');
            return;
        }

        // Send TOTP verification request
        fetch('/password_manager/verify-totp/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                totp_code: totpCode
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store registration data in localStorage to pass to step 2
                    const registrationData = {
                        uuid: document.getElementById('uuid-display').textContent,
                        words: Array.from(document.querySelectorAll('#word-list li'))
                            .map(li => li.textContent.trim()),
                        totp_secret: document.getElementById('totp-code').textContent
                    };
                    localStorage.setItem('registration_data', JSON.stringify(registrationData));

                    // Redirect to step 2
                    window.location.href = '/password_manager/complete-registration/';
                } else {
                    alert('TOTP verification failed: ' + (data.error || 'Invalid code'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during verification');
            });
    });

    // Download credentials
    document.getElementById('download-credentials').addEventListener('click', function () {
        const uuid = document.getElementById('uuid-display').textContent;
        const words = Array.from(document.querySelectorAll('#word-list li'))
            .map(li => li.textContent.trim());
        const totpSecret = document.getElementById('totp-code').textContent;

        const credentials = {
            uuid: uuid,
            words: words,
            totp_secret: totpSecret,
            created_at: new Date().toISOString(),
            warning: "KEEP THIS FILE SECURE! You cannot recover your account without this information."
        };

        const blob = new Blob([JSON.stringify(credentials, null, 2)],
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'secure-credentials.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
// Utility functions
function strToUTF8Arr(str) {
    return new TextEncoder().encode(str);
}

function base64EncArr(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}

// Key derivation function using Argon2id parameters 
async function getMasterKey(password, salt) {
    // Modify the getMasterKey function to use the highest secure parameters possible

    async function getMasterKey(password, salt) {
        // In a production implementation, we would use Argon2id with these parameters:
        // Memory: 1 GiB, Iterations: 4, Parallelism: 4
        // For browser compatibility, we use the highest PBKDF2 params possible

        const baseKey = await window.crypto.subtle.importKey(
            "raw",
            password,
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 600000, // Higher is better, but performance becomes an issue
                hash: "SHA-256"
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );
    }
}

// Fix the generateWrappedKey function to handle IV properly

async function generateWrappedKey(password, uuid) {
    // Convert UUID to bytes for salt
    const salt = strToUTF8Arr(uuid.replace(/-/g, ""));

    // Generate a random AES-GCM key to wrap (this will be used for encrypting vault data)
    const aesGcmParams = { name: "AES-GCM", length: 256 };
    const aesGcmKeyToWrap = await crypto.subtle.generateKey(
        aesGcmParams,
        true,
        ["encrypt", "decrypt"]
    );

    // Derive the key wrapping key using the password and UUID as salt
    const aesKwKey = await getMasterKey(password, salt);

    // Generate IV and wrap the key with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const wrappedKey = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKwKey,
        await window.crypto.subtle.exportKey("raw", aesGcmKeyToWrap)
    );

    // Combine IV and wrapped key
    const wrappedKeyWithIV = new Uint8Array(iv.length + wrappedKey.byteLength);
    wrappedKeyWithIV.set(iv, 0);
    wrappedKeyWithIV.set(new Uint8Array(wrappedKey), iv.length);

    return wrappedKeyWithIV.buffer;
}

}

// Function to generate and wrap a key
async function generateWrappedKey(password, uuid) {
    // Convert UUID to bytes for salt
    const salt = strToUTF8Arr(uuid.replace(/-/g, ""));

    // Generate a random AES-GCM key to wrap (this will be used for encrypting vault data)
    const aesGcmParams = { name: "AES-GCM", length: 256 };
    const aesGcmKeyToWrap = await crypto.subtle.generateKey(
        aesGcmParams,
        true,
        ["encrypt", "decrypt"]
    );

    // Derive the key wrapping key using the password and UUID as salt
    const aesKwKey = await getMasterKey(password, salt);

    // Wrap the AES-GCM key
    const wrappedKey = await window.crypto.subtle.wrapKey(
        "raw",
        aesGcmKeyToWrap,
        aesKwKey,
        "AES-KW"
    );

    return wrappedKey;
}

// Function to generate HMAC signatures
async function generateHMAC(key, data) {
    const hmacKey = await window.crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    return window.crypto.subtle.sign("HMAC", hmacKey, data);
}

// Function to compute authentication hash
async function getAuthHash(password, authWords, uuid) {
    // Combine password and auth words
    const combined = new Uint8Array(password.length + authWords.length);
    combined.set(new Uint8Array(password), 0);
    combined.set(new Uint8Array(authWords), password.length);

    // Use UUID as salt
    const salt = strToUTF8Arr(uuid.replace(/-/g, ""));

    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        combined,
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 600000,
            hash: "SHA-256"
        },
        baseKey,
        256
    );

    return derivedBits;
}

document.addEventListener('DOMContentLoaded', function () {
    const registrationForm = document.getElementById('complete-registration-form');

    registrationForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        // Get form values
        const username = document.getElementById('username').value.normalize("NFKC");
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const email = document.getElementById('email').value;

        // Validate inputs
        if (password !== confirmPassword) {
            alert("Passwords don't match");
            return;
        }

        try {
            // Get stored registration data from localStorage (passed from step 1)
            const registrationData = JSON.parse(localStorage.getItem('registration_data'));
            if (!registrationData) {
                alert("Registration data not found. Please restart registration.");
                window.location.href = '/password_manager/initial-registration/';
                return;
            }

            const uuid = registrationData.uuid;
            const authWords = registrationData.words.slice(0, 5).join(' ');
            const hmacWords = registrationData.words.slice(5, 10).join(' ');

            // Convert to array buffers
            const usernameBuffer = strToUTF8Arr(username).buffer;
            const passwordBuffer = strToUTF8Arr(password).buffer;
            const authWordsBuffer = strToUTF8Arr(authWords).buffer;
            const hmacWordsBuffer = strToUTF8Arr(hmacWords).buffer;

            // 1. Hash the username with SHA-512
            const usernameHash = await window.crypto.subtle.digest("SHA-512", usernameBuffer);

            // 2. Generate and wrap the encryption key
            const wrappedKey = await generateWrappedKey(passwordBuffer, uuid);

            // 3. Generate HMAC for the wrapped key
            const hmacWrappedKey = await generateHMAC(hmacWordsBuffer, wrappedKey);

            // 4. Create authentication hash
            const authHash = await getAuthHash(passwordBuffer, authWordsBuffer, uuid);

            // 5. Prepare payload
            const payload = {
                username_hash: base64EncArr(usernameHash),
                wrapped_key: base64EncArr(wrappedKey),
                hmac_wrapped_key: base64EncArr(hmacWrappedKey),
                auth_hash: base64EncArr(authHash),
                algorithm: 'aesgcm', // or xchacha20 if selected
                email: email || ''
            };

            // 6. Send to server
            const response = await fetch('/password_manager/complete-registration/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                // Clear sensitive data
                localStorage.removeItem('registration_data');

                // Show success message
                alert("Registration complete! You can now log in with your credentials.");
                window.location.href = '/password_manager/login/';
            } else {
                alert("Registration failed: " + (data.error || "Unknown error"));
            }

        } catch (error) {
            console.error('Registration error:', error);
            alert("An error occurred during registration");
        }

        // Clear sensitive form fields
        document.getElementById('password').value = '';
        document.getElementById('confirm-password').value = '';
    });
});
