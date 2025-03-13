// LoginTOTP.js - Component for the TOTP (two-factor) authentication step
const { useSelector, useDispatch } = ReactRedux;

function LoginTOTP() {
    const [totpCode, setTotpCode] = React.useState('');
    const loading = useSelector(state => state.auth.loading);
    const error = useSelector(state => state.auth.error);
    const usernameHash = useSelector(state => state.auth.usernameHash);
    const cryptoKey34 = useSelector(state => state.auth.cryptoKey34);
    const dispatch = useDispatch();

    // Redirect if required data is missing
    React.useEffect(() => {
        if (!usernameHash || !cryptoKey34) {
            dispatch(authActions.setLoginStep(1));
        }
    }, [usernameHash, cryptoKey34, dispatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!totpCode.trim() || totpCode.length !== 6) {
            dispatch(authActions.setError('Please enter a valid 6-digit TOTP code'));
            return;
        }

        dispatch(authActions.setLoading(true));
        dispatch(authActions.setError(null));

        try {
            // Convert TOTP code to bytes
            const data2 = new Uint8Array(4);
            new DataView(data2.buffer).setUint32(0, Number.parseInt(totpCode));

            // Send to server
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: data2,
                credentials: 'same-origin'
            });

            if (response.ok) {
                // Process the response
                const responseArrayBuffer = await response.arrayBuffer();
                const wrappedKey = new Uint8Array(responseArrayBuffer.slice(0, 32));
                const pbkdf2Salt = new Uint8Array(responseArrayBuffer.slice(32, 48));
                const vault = new Uint8Array(responseArrayBuffer.slice(48));

                // Convert vault to JSON
                const decoder = new TextDecoder();
                const jsonString = decoder.decode(vault);
                const jsonObject = JSON.parse(jsonString);

                // Validate the JSON against schema
                // This would be implemented in a real application

                // Get the unwrapped key (simplified - actual implementation would use the password)
                const unwrappedKey = await getUnwrappedKey(wrappedKey, pbkdf2Salt);

                // Store in IndexedDB (simplified)
                await storeStuff(jsonObject, cryptoKey34, unwrappedKey);

                // Clear sensitive data from Redux
                dispatch(authActions.clearSensitiveData());

                // Redirect to vault
                window.location.href = '/password_manager/vault/';
            } else {
                dispatch(authActions.setError('Incorrect TOTP code'));
            }
        } catch (error) {
            dispatch(authActions.setError('Error processing TOTP: ' + error.message));
        } finally {
            dispatch(authActions.setLoading(false));
            setTotpCode('');
        }
    };

    return (
        <div className="login-container">
            <h1>Secure Password Manager</h1>
            <div className="login-panel">
                <h2>Two-Factor Authentication</h2>
                <p className="instructions">Enter the 6-digit code from your authenticator app.</p>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group totp-input-container">
                        <label htmlFor="twoFaCode">TOTP Code</label>
                        <input
                            type="text"
                            id="twoFaCode"
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            autoComplete="off"
                            maxLength="6"
                            pattern="[0-9]{6}"
                            inputMode="numeric"
                            disabled={loading}
                            required
                            className="totp-input"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn primary"
                        disabled={loading || totpCode.length !== 6}
                    >
                        {loading ? 'Verifying...' : 'Login'}
                    </button>

                    <button
                        type="button"
                        className="btn secondary"
                        onClick={() => dispatch(authActions.setLoginStep(3))}
                        disabled={loading}
                    >
                        Back
                    </button>
                </form>
            </div>
        </div>
    );
}
