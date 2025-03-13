// LoginUsername.js - Component for the username entry step
const { useSelector, useDispatch } = ReactRedux;

function LoginUsername() {
    const [username, setUsername] = React.useState('');
    const loading = useSelector(state => state.auth.loading);
    const error = useSelector(state => state.auth.error);
    const dispatch = useDispatch();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim()) {
            dispatch(authActions.setError('Username cannot be empty'));
            return;
        }

        dispatch(authActions.setLoading(true));
        dispatch(authActions.setError(null));

        try {
            // Convert username to UTF-8 array
            const usernameArray = strToUTF8Arr(username);

            // Hash the username with SHA-512
            const usernameHash = await window.crypto.subtle.digest('SHA-512', usernameArray.buffer);

            // Store the hash in Redux state
            dispatch(authActions.setUsernameHash(usernameHash));

            // Move to the next step
            dispatch(authActions.setLoginStep(2));
        } catch (error) {
            dispatch(authActions.setError('Error processing username: ' + error.message));
        } finally {
            dispatch(authActions.setLoading(false));

            // Clear the username from memory
            setUsername('');
        }
    };

    return (
        <div className="login-container">
            <h1>Secure Password Manager</h1>
            <div className="login-panel">
                <h2>Login with Username</h2>
                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
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
                </form>
            </div>
        </div>
    );
}
