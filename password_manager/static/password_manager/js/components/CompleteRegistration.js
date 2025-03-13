// CompleteRegistration.js
const { Provider, connect } = ReactRedux;
const { createStore } = Redux;

// Redux store for registration form
const initialState = {
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    algorithm: 'aesgcm',
    loading: false,
    error: null
};

// Action types
const UPDATE_FIELD = 'UPDATE_FIELD';
const SUBMIT_FORM_REQUEST = 'SUBMIT_FORM_REQUEST';
const SUBMIT_FORM_SUCCESS = 'SUBMIT_FORM_SUCCESS';
const SUBMIT_FORM_FAILURE = 'SUBMIT_FORM_FAILURE';

// Reducer
function registrationReducer(state = initialState, action) {
    switch (action.type) {
        case UPDATE_FIELD:
            return { ...state, [action.field]: action.value };
        case SUBMIT_FORM_REQUEST:
            return { ...state, loading: true, error: null };
        case SUBMIT_FORM_SUCCESS:
            return { ...state, loading: false };
        case SUBMIT_FORM_FAILURE:
            return { ...state, loading: false, error: action.error };
        default:
            return state;
    }
}

// Create store
const store = createStore(registrationReducer);

// Utility functions from register.js
function strToUTF8Arr(str) {
    return new TextEncoder().encode(str);
}

function base64EncArr(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}

// Component
class CompleteRegistrationComponent extends React.Component {
    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    async handleSubmit(e) {
        e.preventDefault();

        const { username, password, confirmPassword, email, algorithm } = this.props;

        // Validation
        if (password !== confirmPassword) {
            this.props.submitFormFailure("Passwords don't match");
            return;
        }

        // Start submission
        this.props.submitFormRequest();

        try {
            // Get registration data from localStorage
            const registrationData = JSON.parse(localStorage.getItem('registration_data'));
            if (!registrationData) {
                throw new Error("Registration data not found. Please restart registration.");
            }

            const uuid = registrationData.uuid;
            const authWords = registrationData.words.slice(0, 5).join(' ');
            const hmacWords = registrationData.words.slice(5, 10).join(' ');

            // Convert strings to array buffers
            const usernameBuffer = strToUTF8Arr(username).buffer;
            const passwordBuffer = strToUTF8Arr(password).buffer;
            const authWordsBuffer = strToUTF8Arr(authWords).buffer;
            const hmacWordsBuffer = strToUTF8Arr(hmacWords).buffer;

            // 1. Hash the username with SHA-512
            const usernameHash = await window.crypto.subtle.digest("SHA-512", usernameBuffer);

            // 2. Generate and wrap the encryption key
            // For a real implementation, this would use Argon2id
            // Since we can't use the actual Argon2id in browsers easily, using SubtleCrypto instead
            const saltData = uuid.replace(/-/g, "");
            const salt = strToUTF8Arr(saltData);

            // Import password as key material
            const passwordKey = await window.crypto.subtle.importKey(
                "raw",
                passwordBuffer,
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );

            // Derive key for wrapping
            const derivedKey = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 600000, // high iteration count as substitute for Argon2id
                    hash: "SHA-256"
                },
                passwordKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt", "wrapKey"]
            );

            // Generate a random AES-GCM key to wrap (for encrypting vault data)
            const keyToWrap = await window.crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );

            // Wrap the key
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const wrappedKey = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                derivedKey,
                await window.crypto.subtle.exportKey("raw", keyToWrap)
            );

            // Combine IV and wrapped key
            const wrappedKeyWithIV = new Uint8Array(iv.length + wrappedKey.byteLength);
            wrappedKeyWithIV.set(iv, 0);
            wrappedKeyWithIV.set(new Uint8Array(wrappedKey), iv.length);

            // 3. Generate HMAC for the wrapped key
            const hmacKeyMaterial = await window.crypto.subtle.importKey(
                "raw",
                hmacWordsBuffer,
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"]
            );

            const hmacWrappedKey = await window.crypto.subtle.sign(
                "HMAC",
                hmacKeyMaterial,
                wrappedKeyWithIV
            );

            // 4. Create authentication hash (simplified - would use Argon2id in production)
            const combinedAuth = new Uint8Array(passwordBuffer.byteLength + authWordsBuffer.byteLength);
            combinedAuth.set(new Uint8Array(passwordBuffer), 0);
            combinedAuth.set(new Uint8Array(authWordsBuffer), passwordBuffer.byteLength);

            const authHash = await window.crypto.subtle.digest("SHA-256", combinedAuth);

            // 5. Prepare payload
            const payload = {
                username_hash: base64EncArr(usernameHash),
                wrapped_key: base64EncArr(wrappedKeyWithIV),
                hmac_wrapped_key: base64EncArr(hmacWrappedKey),
                auth_hash: base64EncArr(authHash),
                algorithm: algorithm,
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

                // Success!
                this.props.submitFormSuccess();

                // Show success message and redirect
                alert("Registration complete! You can now log in with your credentials.");
                window.location.href = '/password_manager/login/';
            } else {
                this.props.submitFormFailure(data.error || "Unknown error");
                alert("Registration failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.props.submitFormFailure(error.message);
            alert("An error occurred during registration: " + error.message);
        }
    }

    render() {
        const {
            username, password, confirmPassword, email, algorithm,
            updateField, loading, error
        } = this.props;

        return (
            <div className="complete-registration">
                <h1>Complete Your Registration</h1>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={this.handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => updateField('username', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => updateField('password', e.target.value)}
                            required
                        />
                        <p className="password-requirements">
                            Use a strong, unique password you don't use elsewhere
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => updateField('confirmPassword', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email (Optional - for UUID recovery)</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => updateField('email', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="algorithm">Encryption Algorithm</label>
                        <select
                            id="algorithm"
                            value={algorithm}
                            onChange={(e) => updateField('algorithm', e.target.value)}
                        >
                            <option value="aesgcm">AES-GCM 256-bit</option>
                            <option value="xchacha20">XChaCha20-Poly1305</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="btn primary"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Complete Registration'}
                    </button>
                </form>
            </div>
        );
    }
}

// Connect to Redux
const mapStateToProps = (state) => ({
    username: state.username,
    password: state.password,
    confirmPassword: state.confirmPassword,
    email: state.email,
    algorithm: state.algorithm,
    loading: state.loading,
    error: state.error
});

const mapDispatchToProps = (dispatch) => ({
    updateField: (field, value) => dispatch({
        type: UPDATE_FIELD, field, value
    }),
    submitFormRequest: () => dispatch({ type: SUBMIT_FORM_REQUEST }),
    submitFormSuccess: () => dispatch({ type: SUBMIT_FORM_SUCCESS }),
    submitFormFailure: (error) => dispatch({
        type: SUBMIT_FORM_FAILURE, error
    })
});

const ConnectedCompleteRegistration = connect(
    mapStateToProps,
    mapDispatchToProps
)(CompleteRegistrationComponent);

// Render the component
ReactDOM.render(
    <Provider store={store}>
        <ConnectedCompleteRegistration />
    </Provider>,
    document.getElementById('root')
);
