// LoginSecrets.js - Component for the secrets entry step
const { useSelector, useDispatch } = ReactRedux;

function LoginSecrets() {
    const [secrets, setSecrets] = React.useState(Array(10).fill(''));
    const loading = useSelector(state => state.auth.loading);
    const error = useSelector(state => state.auth.error);
    const usernameHash = useSelector(state => state.auth.usernameHash);
    const dispatch = useDispatch();

    // If usernameHash is not available, redirect to username step
    React.useEffect(() => {
        if (!usernameHash) {
            dispatch(authActions.setLoginStep(1));
        }
    }, [usernameHash, dispatch]);

    const handleChange = (index, value) => {
        const updatedSecrets = [...secrets];
        updatedSecrets[index] = value;
        setSecrets(updatedSecrets);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check if any field is empty
        if (secrets.some(word => !word.trim())) {
            dispatch(authActions.setError('All secret words are required'));
            return;
        }

        dispatch(authActions.setLoading(true));
        dispatch(authActions.setError(null));

        try {
            // Split the words into two groups
            const firstFiveWords = secrets.slice(0, 5).join(' ');
            const secondFiveWords = secrets.slice(5, 10).join(' ');

            // Convert to UTF-8 arrays
            const secretKey12ArrayBuffer = strToUTF8Arr(firstFiveWords).buffer;
            const secretKey34ArrayBuffer = strToUTF8Arr(secondFiveWords).buffer;

            // Get the signature and key
            const algorithm = { name: 'HMAC', hash: 'SHA-512' };

            // Create the first signature (signature12)
            const cryptoKey12 = await window.crypto.subtle.importKey(
                'raw',
                secretKey12ArrayBuffer,
                algorithm,
                false,
                ['sign']
            );

            const signature12 = await window.crypto.subtle.sign(
                algorithm,
                cryptoKey12,
                usernameHash
            );

            // Create the second key (cryptoKey34)
            const cryptoKey34 = await window.crypto.subtle.importKey(
                'raw',
                secretKey34ArrayBuffer,
                algorithm,
                true,
                ['sign']
            );

            // Create argon2id_salt by concatenating signature12 and usernameHash
            const signature12Array = new Uint8Array(signature12);
            const argon2Salt = new Uint8Array(signature12Array.length + usernameHash.byteLength);
            argon2Salt.set(signature12Array);
            argon2Salt.set(new Uint8Array(usernameHash), signature12Array.length);

            // Store in Redux state
            dispatch(authActions.setCryptoKey34(cryptoKey34));
            dispatch(authActions.setArgon2Salt(argon2Salt));

            // Move to the next step
            dispatch(authActions.setLoginStep(3));
        } catch (error) {
            dispatch(authActions.setError('Error processing secret words: ' + error.message));
        } finally {
            dispatch(authActions.setLoading(false));

            // Clear secrets from component state
            setSecrets(Array(10).fill(''));
        }
    };

    return (
        <div className="login-container">
            <h1>Secure Password Manager</h1>
            <div className="login-panel">
                <h2>Enter Your Secret Words</h2>
                <p className="instructions">Please enter your 10 secret words in the correct order.</p>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="secrets-grid">
                        {secrets.map((secret, index) => (
                            <div key={index} className="form-group">
                                <label htmlFor={`secret_key${index + 1}`}>Word {index + 1}</label>
                                <input
                                    type="text"
                                    id={`secret_key${index + 1}`}
                                    value={secret}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    autoComplete="off"
                                    disabled={loading}
                                    required
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        type="submit"
                        className="btn primary"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Continue'}
                    </button>

                    <button
                        type="button"
                        className="btn secondary"
                        onClick={() => dispatch(authActions.setLoginStep(1))}
                        disabled={loading}
                    >
                        Back
                    </button>
                </form>
            </div>
        </div>
    );
}
