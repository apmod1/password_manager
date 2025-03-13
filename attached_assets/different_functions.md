# Different Functions #

## **Registration** ##
### 1. On page load

#### 1. Client-side

* UUID
* 10 random words

#### 2. Server-side

* TOTP secret key

		
### 	2. First screen ###
#### 1. Items


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

#### 2. Additional notes		    

* The user will have an option to provide an email address for recovery of the UUID. Email is only for recovery of UUID.
* If the user chooses not to save the UUID in any way (through remembering device, downloading it, or setting up an email), user can't login.
* If the user doesn't have password, user can't login.
* If the user doesn't have username, he can't login.
* If the user doesn't have his TOTP code, he can't login.
* If the user doesn't have 5 words for authentication, he can't login.

### 3. Second Screen ###

#### 1. Items
	
* 	Email (optional)
* 	Username
* 	[Password](#password)

#### 2. SHA-512 of username
	
#### 3. Derived AES Key Wrap (AES-KW) key
	
* Key material is password.
* Argon2id KDF (for **key derivation**)
	* Parameters
		* Memory cost = 1 GiB
		* Iterations = 4
		* Parallelism = 4
	* Salt
		1. SHA-512 of the username
		2. UUID
		3. Concatenate together 
		4. Turn into bytes (ArrayBuffer/ Uint8)

#### 4. Unwrapped key

* Options
	1. XChaCha20-Poly1305
	2. AES-GCM 256 bits
* Derived client-side randomly
* Encrypted with derived AES-KW key. Known as wrapped key.

#### 5. Argon2id hash (for **authentication**)	
* Key material
	1. Password
	2. 5 randomly generated words issued during registration for authentication
	3. Concatenate
	4. Turn into bytes
* Salt
	1. SHA-512 of the username
	2. UUID
	3. Concatenate together 
	4. Turn into bytes (ArrayBuffer/ Uint8)
* Parameters: Use OWASP configurations (select one based on device specs)

#### 6. Key exchange with server

1. A key pair is generated using libsodium's key exchange protocol on the client side.
2. Key exchange takes place with the server over HTTPS and a secret shared HMAC key is derived.

#### 7. HTML fetch to server

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
		* Key: Shared HMAC key from key exchange with server
		* Message: JSON of payload
	* POST
	* CORS
	* Same-origin request
	* Other security measures

### 3. Server-side processing

* Argon2id hashing of the authentication hash (for **password storage**) 
	* Parameters
		* Memory cost: 46 MiB
		* Iterations: 1
		* Parallelism: 1
	* Random salt
		* 16 bytes

* The entire database of password hashes is encrypted with a key, which is kept in an HSM.
* Separately, the entire database of other items is encrypted at rest with another separate key.
   
## **Logging in**

### 1. On page load
* HMAC key with server using libsodium key exchange

### 2. First screen 

#### 1. Items

* Password (can access via fingerprint after logging in for the first time)
* UUID (if needed)
* Username (if needed)
* 5 random words needed for authentication (if needed)

#### 2. SHA-512 of username

#### 3. Derived AES Key Wrap (AES-KW) key
	
* Key material is password.
* Argon2id KDF (for **key derivation**)
	* Parameters
		* Memory cost = 1 GiB
		* Iterations = 4
		* Parallelism = 4
	* Salt
		1. SHA-512 of the username
		2. UUID
		3. Concatenate together 
		4. Turn into bytes (ArrayBuffer/ Uint8)

#### 4. Argon2id hash (for **authentication**)	
* Key material
	1. Password
	2. 5 randomly generated words issued during registration for authentication
	3. Concatenate
	4. Turn into bytes
* Salt
	1. SHA-512 of the username
	2. UUID
	3. Concatenate together 
	4. Turn into bytes (ArrayBuffer/ Uint8)
* Parameters: Use OWASP configurations (select one based on device specs)

#### 5. HTML fetch request
* Payload: in JSON format
	* UUID
	* SHA-512 hash of username
	* Argon2id hash (for **authentication**)
* Headers
	* X-HMAC
		* Key: Shared HMAC key from key exchange with server
		* Message: JSON of payload
	* POST
	* CORS
	* Same-origin request
	* Other security measures

#### 6. Delete from memory
* Password
* Argon2id hash from memory

### 2. Server-side 

#### 1. Verify Argon2id hash (for **authentication**) 

* Argon2id hashing of the authentication hash (for **password storage**) 
	* Parameters
		* Memory cost: 46 MiB
		* Iterations: 1
		* Parallelism: 1
	* Salt stored 
		* 16 bytes

### 3. Second screen (if successful response)


#### 1. Items
* 5 random words for generating HMAC signatures (can access via fingerprint after logging in for the first time)
* TOTP code

#### 2. HTML fetch response
* Payload: in JSON format
	* TOTP code
	* SHA-512 hash of username
	* UUID
* Headers
	* X-HMAC
		* Key: Shared HMAC key from key exchange with server
		* Message: JSON of payload
	* POST
	* CORS
	* Same-origin request
	* Other security measures

### 4. Server-side (if successful response)

#### 1. Verify integrity of X-HMAC (how to do?)

#### 2. Response

* Payload: JSON format
	* User data
	* Wrapped Key
	* Algorithm for unwrapped key
	* HMAC of wrapped key
* Headers
	* X-HMAC
		* Key: Shared HMAC key from key exchange with server
		* Message: JSON of payload
	* Response headers


### 5. Verification of user data client-side

#### 1. Verify integrity of X-HMAC (how to do?)

#### 2. Verify integrity of wrapped key

* HMAC
	* Key: Second set of 5 words turned into bytes
	* Message: Wrapped key
	* Digest length: 256 bits

### 6. Validate user data against JSON schema
### 7. Decryption

* AES-KW wrapped key
	* Key: derived from password using Argon2id
	* Data: Wrapped key

### 8. Storage in IndexedDB

#### 1. Items 

* User data/vault

### 9. Delete from memory

#### 1. Items
* wrapped key
* AES-KW key

## Modifying user data

### 1. User clicks on clicks on an existing item. First Screen

#### 1. Items

* Follow JSON schema	

#### 2. Separation of field bytestrings for each field 
1. Base 64 decode field bytestring
2. IV + ciphertext of field needs be separated

#### 3. Decrypt item

* For all fields, decrypt separately
* Key: Unwrapped key
* Data: encrypted field
* AAD:
	* HMAC
		* Key: 5 random words from registration
		* Message: UUID
* IV
	

#### 4. User modifies a field in the item

#### 5. User saves item. 

#### 6. Encrypt.

* For all fields encrypt separately
* * XChaCha20-Poly1305 or AES-GCM 256 bit
	* Key: Unwrap key
	* Data: Changed field
	* AAD 
		* HMAC
			* Key: 5 random words from registration
			* Message: UUID
	* New IV

#### 7. Concatenate field bytestrings

1. Join IV + encrypted field ciphertext
2. Base64 encode field bytestring

#### 8. HTML fetch request

* Payload: in JSON format
	* UUID
	* SHA-512 of username
	* JSON of field bytestrings
* Headers
	* X-HMAC
		* Key: Shared HMAC key from key exchange with server
		* Message: JSON of payload
	* POST
	* CORS
	* Same-origin request
	* Other security measures

### 2. Server-side (if connected else store in IndexedDB)

#### 1. Verify integrity of X-HMAC
#### 2. Store data

### 3. Second screen (if successful at saving)

1. Items
	* Name of item
	* Success message


## Creating user data

### 1. User clicks on new item. First screen

#### 1. Items

* Follow JSON schema	

#### 2. User fills out a field in the item

#### 3. User saves item. E

#### 4. Encrypt

* For all fields encrypt separately
* XChaCha20-Poly1305 or AES-GCM 256 bit
	* Key: Unwrap key
	* Data: Changed field
	* AAD 
		* HMAC
			* Key: 5 random words from registration
			* Message: UUID
	* New IV

#### 5. Concatenate field bytestrings

1. Join IV + encrypted field ciphertext
2. Base64 encode field bytestring

#### 6. HTML fetch request

* Payload: in JSON format
	* UUID
	* SHA-512 of username
	* JSON of field bytestrings
* Headers
	* X-HMAC
		* Key: Shared HMAC key from key exchange with server
		* Message: JSON of payload
	* POST
	* CORS
	* Same-origin request
	* Other security measures

### 2. Server-side (if connected else store in IndexedDB)

#### 1. Verify integrity of X-HMAC
#### 2. Store data

### 3. Second screen (if successful at saving)

1. Items
	* Name of item
	* Success message


## Technologies used
1. Django
2. React
3. Webpack
4. LibNACL
