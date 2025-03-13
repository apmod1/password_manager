[TOC]
# **Registration** #
## 1. On page load

### 1. Client-side

* UUID - Generate in JavaScript, PyQt (use uuid library in Python)
* 10 random words are generated

### 2. Server-side

* TOTP secret key
		
## 	2. First screen ###
### 1. Items


* TOTP secret key is shown (along with QR code for authenticator app).
* Verification of TOTP
* 10 random words are generated. ten-words
	* 5 of these words are used for authentication
	* 5 words will be used as key to generate hashed messages using HMAC with SHA-256.
* UUID is shown
* Warning for users to save UUID, 10 random words, and TOTP secret key. Users can download a file with this information. 
* Warning to users to save this information.
* Download button for a file containing
	*  TOTP secret key
	*  UUID
	*  10 secret words.
* Remember device option saves
	* UUID
	* 5 words for authentication
	* Username SHA-512 hash

### 2. Additional notes		    

* The user will have an option to provide an email address for recovery of the UUID. Email is only for recovery of UUID.
* If the user chooses not to save the UUID in any way (through remembering device, downloading it, or setting up an email), user can't login.
* If the user doesn't have password, user can't login.
* If the user doesn't have username, he can't login.
* If the user doesn't have his TOTP code, he can't login.
* If the user doesn't have 5 words for authentication, he can't login.

## 3. Second Screen ###

### 1. Items
	
* 	Email (optional)
* 	Username
* 	Password

### 2. SHA-512 of username
	
### 3. Derived AES Key Wrap (AES-KW) key
	
* Key material is password.
* Argon2id KDF (for **key derivation**)
	* Parameters
		* Memory cost = 1 GiB
		* Iterations = 4
		* Parallelism = 4
	* Salt
		1. UUID

### 4. Unwrapped key

* Options
	1. XChaCha20-Poly1305
	2. AES-GCM 256 bits
* Derived client-side randomly
* Encrypted with derived AES-KW key. Known as wrapped key.

### 5. Argon2id hash (for **authentication**)	
* Key material
	1. Password
	2. 5 randomly generated words issued during registration for authentication
	3. Concatenate
	4. Turn into bytes
* Salt
	1. UUID

* Parameters: Use OWASP configurations (select one based on device specs)

### 6. Key exchange with server

1. Use crypto_kx* API.
2. Key exchange takes place with the server over HTTPS

### 7. HTML fetch to server

* Payload: in JSON format
	* HMAC
		* Key: Second set of 5 words turned into bytes
		* Message: Wrapped key
		* Digest length: 256 bits
	* UUID
	* SHA-512 hash of the username
	* Algorithm of the unwrapped key
	* Argon2id hash (for **authentication**)
	* Wrapped key
	* Email (optional)
* Headers
	* X-HMAC
		* Key: Client side HMAC key from crypto_kx
		* Message: JSON of payload
	* POST
	* CORS
	* Same-origin request
	* Other security measures (refer to OWASP cheat sheet)

## 3. Server-side processing

* Argon2id hashing of the authentication hash (for **password storage**) 
	* Parameters
		* Memory cost: 46 MiB
		* Iterations: 1
		* Parallelism: 1
	* Random salt
		* 16 bytes
* Use Django password storage?
* The entire database of password hashes is encrypted with a key, which is kept in an HSM.
* Separately, the entire database of other items is encrypted at rest with another separate key.