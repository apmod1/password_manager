// LoginPassword.js - Component for the password entry step
const { useSelector, useDispatch } = ReactRedux;

function LoginPassword() {
    const [password, setPassword] = React.useState('');
    const loading = useSelector(state => state.auth.loading);
    const error = useSelector(state => state.auth.error);
    const usernameHash = useSelector(state => state.auth.usernameHash);
    const argon2Salt = useSelector(state => state.auth.argon2Salt);
    const dispatch = useDispatch();

    // Redirect if required data is missing
    React.useEffect(() => {
        if (!usernameHash || !argon2Salt) {
            dispatch(authActions.setLoginStep(1));
        }
    }, [usernameHash, argon2Salt, dispatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password.trim()) {
            dispatch(authActions.setError('Password cannot be empty'));
            return;
        }

        dispatch(authActions.setLoading(true));
        dispatch(authActions.setError(null));

        try {
            // Convert password to UTF-8 array
            const passwordArray = strToUTF8Arr(password);
            const passwordBuffer = passwordArray.buffer;

            // Get Argon2id hash
            const argon2idKey = await getArgon2Hash(passwordBuffer, argon2Salt);

            // Combine usernameHash and argon2idKey
            const data = new Uint8Array(usernameHash.byteLength + argon2idKey.byteLength);
            data.set(new Uint8Array(usernameHash), 0);
            data.set(new Uint8Array(argon2idKey), usernameHash.byteLength);

            // Send to server
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: data,
                credentials: 'same-origin'
            });

            if (response.ok) {
                // Move to TOTP step
                dispatch(authActions.setLoginStep(4));
            } else {
                dispatch(authActions.setError('Incorrect username or password'));
            }
        } catch (error) {
            dispatch(authActions.setError('Error processing password: ' + error.message));
        } finally {
            dispatch(authActions.setLoading(false));

            // Clear password from memory
            setPassword('');
        }
    };

    return (
        <div className="login-container">
            <h1>Secure Password Manager</h1>
            <div className="login-panel">
                <h2>Enter Your Password</h2>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="off"
                            disabled={loading}
                            required
                        />
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
                        onClick={() => dispatch(authActions.setLoginStep(2))}
                        disabled={loading}
                    >
                        Back
                    </button>
                </form>
            </div>
        </div>
    );
}
