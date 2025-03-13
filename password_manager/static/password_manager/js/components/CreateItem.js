// CreateItem.js - Component to create new vault items
const { useSelector, useDispatch } = ReactRedux;

function CreateItem() {
    const loading = useSelector(state => state.loading);
    const error = useSelector(state => state.error);
    const dispatch = useDispatch();

    const [formData, setFormData] = React.useState({
        name: '',
        type: 'password',
        fields: {
            username: '',
            password: '',
            url: '',
            notes: ''
        }
    });

    // Adjust fields based on item type
    React.useEffect(() => {
        if (formData.type === 'password') {
            setFormData(prev => ({
                ...prev,
                fields: {
                    username: prev.fields.username || '',
                    password: prev.fields.password || '',
                    url: prev.fields.url || '',
                    notes: prev.fields.notes || ''
                }
            }));
        } else if (formData.type === 'card') {
            setFormData(prev => ({
                ...prev,
                fields: {
                    cardNumber: prev.fields.cardNumber || '',
                    cardholderName: prev.fields.cardholderName || '',
                    expiryDate: prev.fields.expiryDate || '',
                    cvv: prev.fields.cvv || '',
                    notes: prev.fields.notes || ''
                }
            }));
        } else if (formData.type === 'note') {
            setFormData(prev => ({
                ...prev,
                fields: {
                    title: prev.fields.title || '',
                    content: prev.fields.content || ''
                }
            }));
        }
    }, [formData.type]);

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

    async function handleSubmit(e) {
        e.preventDefault();
        dispatch(vaultActions.createItemRequest());

        try {
            // Validate form data
            if (!formData.name.trim()) {
                throw new Error('Item name is required');
            }

            // Create a new UUID for the item
            const itemId = crypto.randomUUID();

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

                    // Prepare new item with encrypted fields
                    const newItem = {
                        id: itemId,
                        name: formData.name,
                        type: formData.type,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        fields: {}
                    };

                    // Encrypt each field separately as required by different_functions.md
                    for (const [fieldName, fieldValue] of Object.entries(formData.fields)) {
                        if (!fieldValue.trim()) continue; // Skip empty fields

                        // Generate unique IV for each field
                        const iv = window.crypto.getRandomValues(new Uint8Array(12));

                        // Generate AAD using HMAC with the 5 random words
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
                            strToUTF8Arr(itemId + fieldName).buffer
                        );

                        // Encrypt using AES-GCM (as specified in different_functions.md)
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

                        // Combine IV and ciphertext as specified in different_functions.md
                        const encryptedArray = new Uint8Array(iv.length + encryptedField.byteLength);
                        encryptedArray.set(iv, 0);
                        encryptedArray.set(new Uint8Array(encryptedField), iv.length);

                        // Base64 encode as specified in different_functions.md
                        newItem.fields[fieldName] = base64EncArr(encryptedArray);
                    }

                    // Store in IndexedDB
                    const vaultTransaction = db.transaction(['vault'], 'readwrite');
                    const vaultStore = vaultTransaction.objectStore('vault');
                    const vaultRequest = vaultStore.add(newItem);

                    vaultRequest.onsuccess = async function () {
                        // Also send to server
                        try {
                            const uuid = localStorage.getItem('uuid');
                            const usernameHash = localStorage.getItem('usernameHash');

                            if (uuid && usernameHash) {
                                const payload = {
                                    uuid: uuid,
                                    username_hash: usernameHash,
                                    item: newItem
                                };

                                // Generate HMAC for payload
                                const hmacSignature = await window.crypto.subtle.sign(
                                    hmacAlgorithm,
                                    hmacKeyObj,
                                    encoder.encode(JSON.stringify(payload))
                                );

                                // Send to server
                                const response = await fetch('/password_manager/vault/items/', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-HMAC': base64EncArr(new Uint8Array(hmacSignature))
                                    },
                                    body: JSON.stringify(payload)
                                });

                                if (!response.ok) {
                                    console.warn('Server synchronization failed, but item was created locally');
                                }
                            }
                        } catch (serverError) {
                            console.warn('Server synchronization failed, but item was created locally:', serverError);
                        }

                        dispatch(vaultActions.createItemSuccess(newItem));

                        // Reset form
                        setFormData({
                            name: '',
                            type: 'password',
                            fields: {
                                username: '',
                                password: '',
                                url: '',
                                notes: ''
                            }
                        });

                        // Close modal
                        document.getElementById('create-item-modal').style.display = 'none';
                    };

                    vaultRequest.onerror = function (event) {
                        dispatch(vaultActions.createItemFailure('Failed to save item'));
                        console.error('IndexedDB error:', event.target.error);
                    };
                };
            };

            request.onerror = function (event) {
                dispatch(vaultActions.createItemFailure('Failed to retrieve encryption key'));
                console.error('IndexedDB error:', event.target.error);
            };
        } catch (error) {
            dispatch(vaultActions.createItemFailure('Error creating item: ' + error.message));
            console.error('Creation error:', error);
        }
    }

    function handleCancel() {
        // Reset form
        setFormData({
            name: '',
            type: 'password',
            fields: {
                username: '',
                password: '',
                url: '',
                notes: ''
            }
        });

        // Close modal
        document.getElementById('create-item-modal').style.display = 'none';
    }

    function renderFields() {
        if (formData.type === 'password') {
            return (
                <>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={formData.fields.username}
                            onChange={(e) => handleFieldChange('username', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="password-field">
                            <input
                                type="password"
                                id="password"
                                value={formData.fields.password}
                                onChange={(e) => handleFieldChange('password', e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const field = document.getElementById('password');
                                    field.type = field.type === 'password' ? 'text' : 'password';
                                }}
                                className="btn icon-btn"
                            >
                                👁️
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const password = generateRandomPassword();
                                    handleFieldChange('password', password);
                                }}
                                className="btn icon-btn"
                            >
                                🔄
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="url">URL</label>
                        <input
                            type="url"
                            id="url"
                            value={formData.fields.url}
                            onChange={(e) => handleFieldChange('url', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes</label>
                        <textarea
                            id="notes"
                            value={formData.fields.notes}
                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                            rows="3"
                        ></textarea>
                    </div>
                </>
            );
        } else if (formData.type === 'card') {
            return (
                <>
                    <div className="form-group">
                        <label htmlFor="cardNumber">Card Number</label>
                        <input
                            type="text"
                            id="cardNumber"
                            value={formData.fields.cardNumber}
                            onChange={(e) => handleFieldChange('cardNumber', e.target.value)}
                            pattern="[0-9\s]{13,19}"
                            placeholder="XXXX XXXX XXXX XXXX"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="cardholderName">Cardholder Name</label>
                        <input
                            type="text"
                            id="cardholderName"
                            value={formData.fields.cardholderName}
                            onChange={(e) => handleFieldChange('cardholderName', e.target.value)}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group half">
                            <label htmlFor="expiryDate">Expiry Date</label>
                            <input
                                type="text"
                                id="expiryDate"
                                value={formData.fields.expiryDate}
                                onChange={(e) => handleFieldChange('expiryDate', e.target.value)}
                                placeholder="MM/YY"
                            />
                        </div>

                        <div className="form-group half">
                            <label htmlFor="cvv">CVV</label>
                            <input
                                type="password"
                                id="cvv"
                                value={formData.fields.cvv}
                                onChange={(e) => handleFieldChange('cvv', e.target.value)}
                                maxLength="4"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes</label>
                        <textarea
                            id="notes"
                            value={formData.fields.notes}
                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                            rows="3"
                        ></textarea>
                    </div>
                </>
            );
        } else if (formData.type === 'note') {
            return (
                <>
                    <div className="form-group">
                        <label htmlFor="title">Title</label>
                        <input
                            type="text"
                            id="title"
                            value={formData.fields.title}
                            onChange={(e) => handleFieldChange('title', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="content">Content</label>
                        <textarea
                            id="content"
                            value={formData.fields.content}
                            onChange={(e) => handleFieldChange('content', e.target.value)}
                            rows="8"
                        ></textarea>
                    </div>
                </>
            );
        }

        return null;
    }

    function generateRandomPassword() {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
        let password = "";

        const randomValues = new Uint8Array(length);
        window.crypto.getRandomValues(randomValues);

        for (let i = 0; i < length; i++) {
            password += charset[randomValues[i] % charset.length];
        }

        return password;
    }

    return (
        <div id="create-item-modal" className="modal">
            <div className="modal-content">
                <span className="close" onClick={handleCancel}>&times;</span>

                <h2>Create New Item</h2>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Item Name</label>
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
                        <label htmlFor="type">Item Type</label>
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

                    <div className="divider"></div>

                    {renderFields()}

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="btn primary"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Item'}
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
        </div>
    );
}
