// InitialRegistration.js
const { Provider, connect } = ReactRedux;
const { createStore } = Redux;

// Redux store for registration data
const initialState = {
    uuid: document.getElementById('uuid-display')?.textContent || '',
    words: Array.from(document.querySelectorAll('#word-list li')).map(li => li.textContent.trim()),
    totpSecret: document.getElementById('totp-code')?.textContent || '',
    totpVerified: false,
    error: null
};

// Action types
const VERIFY_TOTP_REQUEST = 'VERIFY_TOTP_REQUEST';
const VERIFY_TOTP_SUCCESS = 'VERIFY_TOTP_SUCCESS';
const VERIFY_TOTP_FAILURE = 'VERIFY_TOTP_FAILURE';

// Reducer
function registrationReducer(state = initialState, action) {
    switch (action.type) {
        case VERIFY_TOTP_REQUEST:
            return { ...state, loading: true, error: null };
        case VERIFY_TOTP_SUCCESS:
            return { ...state, loading: false, totpVerified: true };
        case VERIFY_TOTP_FAILURE:
            return { ...state, loading: false, error: action.error };
        default:
            return state;
    }
}

// Create store
const store = createStore(registrationReducer);

// Initialize React component
class InitialRegistrationComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            totpCode: ''
        };

        this.handleTotpChange = this.handleTotpChange.bind(this);
        this.handleVerifyTotp = this.handleVerifyTotp.bind(this);
        this.copyUuid = this.copyUuid.bind(this);
        this.copyWords = this.copyWords.bind(this);
        this.downloadCredentials = this.downloadCredentials.bind(this);
    }

    handleTotpChange(e) {
        this.setState({ totpCode: e.target.value });
    }

    async handleVerifyTotp() {
        const { totpCode } = this.state;

        if (!totpCode || totpCode.length !== 6) {
            alert('Please enter a valid 6-digit TOTP code');
            return;
        }

        try {
            const response = await fetch('/password_manager/verify-totp/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ totp_code: totpCode })
            });

            const data = await response.json();

            if (data.success) {
                // Store registration data
                const registrationData = {
                    uuid: this.props.uuid,
                    words: this.props.words,
                    totpSecret: this.props.totpSecret
                };
                localStorage.setItem('registration_data', JSON.stringify(registrationData));

                // Dispatch success action
                this.props.verifyTotpSuccess();

                // Redirect to step 2
                window.location.href = '/password_manager/complete-registration/';
            } else {
                this.props.verifyTotpFailure(data.error || 'Verification failed');
                alert('TOTP verification failed: ' + (data.error || 'Invalid code'));
            }
        } catch (error) {
            this.props.verifyTotpFailure(error.message);
            alert('An error occurred during verification');
        }
    }

    copyUuid() {
        navigator.clipboard.writeText(this.props.uuid).then(() => {
            alert('UUID copied to clipboard');
        });
    }

    copyWords() {
        navigator.clipboard.writeText(this.props.words.join(' ')).then(() => {
            alert('Words copied to clipboard');
        });
    }

    downloadCredentials() {
        const credentials = {
            uuid: this.props.uuid,
            words: this.props.words,
            totp_secret: this.props.totpSecret,
            created_at: new Date().toISOString(),
            warning: "KEEP THIS FILE SECURE! You cannot recover your account without this information."
        };

        const blob = new Blob([JSON.stringify(credentials, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'secure-credentials.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    render() {
        const { uuid, words, totpSecret, error, loading, totpVerified } = this.props;

        return (
            <div className="registration-container">
                <h1>Secure Password Manager Registration</h1>

                {error && <div className="error-message">{error}</div>}

                <div className="registration-section">
                    <h2>Your UUID</h2>
                    <code className="uuid-display">{uuid}</code>
                    <button onClick={this.copyUuid} className="btn">Copy UUID</button>
                </div>

                <div className="registration-section">
                    <h2>Your 10 Security Words</h2>
                    <p>First 5 words are for authentication, last 5 for HMAC generation</p>
                    <ul className="word-list">
                        {words.map((word, index) => (
                            <li key={index}>{word}</li>
                        ))}
                    </ul>
                    <button onClick={this.copyWords} className="btn">Copy Words</button>
                </div>

                <div className="registration-section">
                    <h2>TOTP Setup</h2>
                    <p>Scan this QR code with your authenticator app:</p>
                    <div className="qr-container">
                        <img src={document.querySelector('.qr-container img')?.src} alt="TOTP QR Code" />
                    </div>
                    <p>Or enter this code manually:</p>
                    <code className="totp-code">{totpSecret}</code>

                    <div className="totp-verification">
                        <input
                            type="text"
                            value={this.state.totpCode}
                            onChange={this.handleTotpChange}
                            maxLength="6"
                            placeholder="Enter 6-digit code"
                        />
                        <button
                            onClick={this.handleVerifyTotp}
                            className="btn primary"
                            disabled={loading}
                        >
                            {loading ? 'Verifying...' : 'Verify Code'}
                        </button>
                    </div>
                </div>

                <div className="registration-section">
                    <button onClick={this.downloadCredentials} className="btn warning">
                        Download Secure Credentials
                    </button>
                </div>
            </div>
        );
    }
}

// Connect to Redux
const mapStateToProps = (state) => ({
    uuid: state.uuid,
    words: state.words,
    totpSecret: state.totpSecret,
    error: state.error,
    loading: state.loading,
    totpVerified: state.totpVerified
});

const mapDispatchToProps = (dispatch) => ({
    verifyTotpRequest: () => dispatch({ type: VERIFY_TOTP_REQUEST }),
    verifyTotpSuccess: () => dispatch({ type: VERIFY_TOTP_SUCCESS }),
    verifyTotpFailure: (error) => dispatch({ type: VERIFY_TOTP_FAILURE, error })
});

const ConnectedInitialRegistration = connect(
    mapStateToProps,
    mapDispatchToProps
)(InitialRegistrationComponent);

// Render the component
ReactDOM.render(
    <Provider store={store}>
        <ConnectedInitialRegistration />
    </Provider>,
    document.getElementById('root')
);
