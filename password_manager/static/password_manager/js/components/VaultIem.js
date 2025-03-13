// VaultItem.js - Component to view and edit vault items
const { useSelector, useDispatch } = ReactRedux;

function VaultItem() {
    const currentItem = useSelector(state => state.currentItem);
    const loading = useSelector(state => state.loading);
    const error = useSelector(state => state.error);
    const dispatch = useDispatch();

    const [decryptedData, setDecryptedData] = React.useState(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: '',
        type: 'password',
        fields: {}
    });

    // When currentItem changes, decrypt the data
    React.useEffect(() => {
        if (currentItem) {
            decryptItem(currentItem);
        } else {
            setDecryptedData(null);
        }
    }, [currentItem]);

    async function decryptItem(item) {
        try {
            // Retrieve the unwrapped key from IndexedDB
            const db = await openDatabase('vaultDB', 1);
            const transaction = db.transaction(['keys'], 'readonly');
            const store = transaction.objectStore('keys');
            const request = store.get('unwrappedKey');

            request.onsuccess = async function (event) {
                const unwrappedKey = event.target.result;

                if (!unwrappedKey) {
                    throw new Error('Encryption key not found. Please log in again.');
                }

                // Get the HMAC key (5 random words from registration)
                const hmacKeyRequest = store.get('hmacKey');

                hmacKeyRequest.onsuccess = async function (event) {
                    const hmacKey = event.target.result;

                    if (!hmacKey) {
                        throw new Error('HMAC key not found. Please log in again.');
                    }

                    // For each encrypted field, decrypt it
                    const decrypted = {
                        id: item.id,
                        name: item.name,
                        type: item.type,
                        created_at: item.created_at,
                        updated_at: item.updated_at,
                        fields: {}
                    };

                    // Decrypt each field
                    for (const [fieldName, encryptedValue] of Object.entries(item.fields)) {
                        // Base64 decode the field
                        const fieldBytes = base64DecToArr(encryptedValue);

                        // Extract IV (first 12 bytes) and ciphertext
                        const iv = fieldBytes.slice(0, 12);
                        const ciphertext = fieldBytes.slice(12);

                        // Generate AAD using the HMAC key
                        const hmacAlgorithm = { name: 'HMAC', hash: 'SHA-256' };
                        const hmacKeyObj = await window.crypto.subtle.importKey(
                            'raw',
                            hmacKey,
                            hmacAlgorithm,
                            false,
                            ['sign']
                        );

                        const aad = await window.crypto.subtle.sign(
                            hmacAlgorithm,
                            hmacKeyObj,
                            strToUTF8Arr(item.id + fieldName).buffer
                        );

                        // Decrypt using AES-GCM or XChaCha20-Poly1305 based on algorithm
                        // For this example, assuming AES-GCM
                        const decryptAlgorithm = {
                            name: 'AES-GCM',
                            iv: iv,
                            additionalData: aad
                        };

                        const decryptedField = await window.crypto.subtle.decrypt(
                            decryptAlgorithm,
                            unwrappedKey,
                            ciphertext
                        );

                        // Convert decrypted array buffer to string
                        const decoder = new TextDecoder();
                        decrypted.fields[fieldName] = decoder.decode(decryptedField);
                    }

                    // Set the decrypted data
                    setDecryptedData(decrypted);

                    // Initialize form data for editing
                    setFormData({
                        name: decrypted.name,
                        type: decrypted.type,
                        fields: { ...decrypted.fields }
                    });
                };
            };

            request.onerror = function (event) {
                dispatch(vaultActions.setError('Failed to retrieve encryption key'));
                console.error('IndexedDB error:', event.target.error);
            };
        } catch (error) {
            dispatch(vaultActions.setError('Error decrypting item: ' + error.message));
            console.error('Decryption error:', error);
        }
    }

    function handleInputChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }

    function handleFieldChange(fieldName, value) {
        setFormData(prev => ({
            ...prev,
            fields: {
                ...prev.fields,
                [fieldName]: value
            }
        }));
    }

    async function handleSave() {
        dispatch(vaultActions.updateItemRequest());

        try {
            // Retrieve the unwrapped key from IndexedDB
            const db = await openDatabase('vaultDB', 1);
            const transaction = db.transaction(['keys'], 'readonly');
            const store = transaction.objectStore('keys');
            const request = store.get('unwrappedKey');

            request.onsuccess = async function (event) {
                const unwrappedKey = event.target.result;

                if (!unwrappedKey) {
                    throw new Error('Encryption key not found. Please log in again.');
                }

                // Get the HMAC key (5 random words from registration)
                const hmacKeyRequest = store.get('hmacKey');

                hmacKeyRequest.onsuccess = async function (event) {
                    const hmacKey = event.target.result;

                    if (!hmacKey) {
                        throw new Error('HMAC key not found. Please log in again.');
                    }

                    // Prepare updated item with encrypted fields
                    const updatedItem = {
                        id: currentItem.id,
                        name: formData.name,
                        type: formData.type,
                        created_at: currentItem.created_at,
                        updated_at: new Date().toISOString(),
                        fields: {}
                    };

                    // Encrypt each field separately - following different_functions.md requirements
                    for (const [fieldName, fieldValue] of Object.entries(formData.fields)) {
                        // Generate new IV for each field
                        const iv = window.crypto.getRandomValues(new Uint8Array(12));

                        // Generate AAD using HMAC
                        const hmacAlgorithm = { name: 'HMAC', hash: 'SHA-256' };
                        const hmacKeyObj = await window.crypto.subtle.importKey(
                            'raw',
                            hmacKey,
                            hmacAlgorithm,
                            false,
                            ['sign']
                        );

                        const aad = await window.crypto.subtle.sign(
                            hmacAlgorithm,
                            hmacKeyObj,
                            strToUTF8Arr(currentItem.id + fieldName).buffer
                        );

                        // Encrypt using AES-GCM
                        const encryptAlgorithm = {
                            name: 'AES-GCM',
                            iv: iv,
                            additionalData: aad
                        };

                        const encoder = new TextEncoder();
                        const encodedField = encoder.encode(fieldValue);

                        const encryptedField = await window.crypto.subtle.encrypt(
                            encryptAlgorithm,
                            unwrappedKey,
                            encodedField
                        );

                        // Combine IV and ciphertext as per different_functions.md
                        const encryptedArray = new Uint8Array(iv.length + encryptedField.byteLength);
                        encryptedArray.set(iv, 0);
                        encryptedArray.set(new Uint8Array(encryptedField), iv.length);

                        // Base64 encode as per different_functions.md
                        updatedItem.fields[fieldName] = base64EncArr(encryptedArray);
                    }

                    // Update in IndexedDB
                    const vaultTransaction = db.transaction(['vault'], 'readwrite');
                    const vaultStore = vaultTransaction.objectStore('vault');
                    const vaultRequest = vaultStore.put(updatedItem);

                    vaultRequest.onsuccess = async function () {
                        // Send to server
                        try {
                            const uuid = localStorage.getItem('uuid');
                            const usernameHash = localStorage.getItem('usernameHash');

                            if (uuid && usernameHash) {
                                const payload = {
                                    uuid: uuid,
                                    username_hash: usernameHash,
                                    item: updatedItem
                                };

                                // Generate HMAC for payload
                                const hmacSignature = await window.crypto.subtle.sign(
                                    hmacAlgorithm,
                                    hmacKeyObj,
                                    encoder.encode(JSON.stringify(payload))
                                );

                                // Send to server
                                const response = await fetch('/password_manager/vault/items/' + updatedItem.id + '/', {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-HMAC': base64EncArr(new Uint8Array(hmacSignature))
                                    },
                                    body: JSON.stringify(payload)
                                });

                                if (!response.ok) {
                                    console.warn('Server synchronization failed, but item was updated locally');
                                }
                            }
                        } catch (serverError) {
                            console.warn('Server synchronization failed, but item was updated locally:', serverError);
                        }

                        dispatch(vaultActions.updateItemSuccess(updatedItem));
                        setIsEditing(false);

                        // Decrypt again to show updated data
                        decryptItem(updatedItem);
                    };

                    vaultRequest.onerror = function (event) {
                        dispatch(vaultActions.updateItemFailure('Failed to save item'));
                        console.error('IndexedDB error:', event.target.error);
                    };
                };
            };

            request.onerror = function (event) {
                dispatch(vaultActions.updateItemFailure('Failed to retrieve encryption key'));
                console.error('IndexedDB error:', event.target.error);
            };
        } catch (error) {
            dispatch(vaultActions.updateItemFailure('Error saving item: ' + error.message));
            console.error('Save error:', error);
        }
    }

    function handleCancel() {
        setIsEditing(false);
        // Reset form data to original values
        if (decryptedData) {
            setFormData({
                name: decryptedData.name,
                type: decryptedData.type,
                fields: { ...decryptedData.fields }
            });
        }
    }

    function handleClose() {
        dispatch(vaultActions.clearCurrentItem());
        document.getElementById('edit-item-modal').style.display = 'none';
    }

    function renderViewMode() {
        if (!decryptedData) return <div className="loading">Loading item data...</div>;

        return (
            <div className="vault-item-details">
                <div className="vault-item-header">
                    <h2>{decryptedData.name}</h2>
                    <span className="item-type-badge">{decryptedData.type}</span>
                </div>

                <div className="vault-item-fields">
                    {Object.entries(decryptedData.fields).map(([fieldName, fieldValue]) => (
                        <div key={fieldName} className="vault-field">
                            <label>{fieldName}</label>

                            {fieldName.toLowerCase().includes('password') ? (
                                <div className="password-field">
                                    <input
                                        type="password"
                                        value={fieldValue}
                                        readOnly
                                        id={`field-${fieldName}`}
                                    />
                                    <button
                                        onClick={() => {
                                            const field = document.getElementById(`field-${fieldName}`);
                                            field.type = field.type === 'password' ? 'text' : 'password';
                                        }}
                                        className="btn icon-btn"
                                    >
                                        👁️
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(fieldValue);
                                            alert(`${fieldName} copied to clipboard!`);
                                        }}
                                        className="btn icon-btn"
                                    >
                                        📋
                                    </button>
                                </div>
                            ) : (
                                <div className="text-field">
                                    <input
                                        type="text"
                                        value={fieldValue}
                                        readOnly
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(fieldValue);
                                            alert(`${fieldName} copied to clipboard!`);
                                        }}
                                        className="btn icon-btn"
                                    >
                                        📋
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="vault-item-meta">
                    <p>Created: {new Date(decryptedData.created_at).toLocaleString()}</p>
                    <p>Last updated: {new Date(decryptedData.updated_at).toLocaleString()}</p>
                </div>

                <div className="vault-item-actions">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="btn primary"
                    >
                        Edit
                    </button>
                    <button
                        onClick={handleClose}
                        className="btn secondary"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    function renderEditMode() {
        return (
            <div className="vault-item-edit">
                <h2>Edit Item</h2>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="type">Type</label>
                        <select
                            id="type"
                            name="type"
                            value={formData.type}
                            onChange={handleInputChange}
                        >
                            <option value="password">Password</option>
                            <option value="card">Credit Card</option>
                            <option value="note">Secure Note</option>
                        </select>
                    </div>

                    <div className="vault-item-fields">
                        {Object.entries(formData.fields).map(([fieldName, fieldValue]) => (
                            <div key={fieldName} className="form-group">
                                <label htmlFor={`field-${fieldName}`}>{fieldName}</label>
                                <input
                                    type={fieldName.toLowerCase().includes('password') ? 'password' : 'text'}
                                    id={`field-${fieldName}`}
                                    value={fieldValue}
                                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="vault-item-actions">
                        <button
                            type="submit"
                            className="btn primary"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="btn secondary"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div id="edit-item-modal" className="modal">
            <div className="modal-content">
                <span className="close" onClick={handleClose}>&times;</span>
                {isEditing ? renderEditMode() : renderViewMode()}
            </div>
        </div>
    );
}
