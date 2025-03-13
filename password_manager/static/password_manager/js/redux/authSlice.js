// authSlice.js - Redux state management for authentication
const { createStore } = Redux;

// Action types
const SET_LOGIN_STEP = 'SET_LOGIN_STEP';
const SET_USERNAME_HASH = 'SET_USERNAME_HASH';
const SET_ERROR = 'SET_ERROR';
const SET_LOADING = 'SET_LOADING';
const SET_CRYPTO_KEY_34 = 'SET_CRYPTO_KEY_34';
const SET_ARGON2_SALT = 'SET_ARGON2_SALT';
const CLEAR_SENSITIVE_DATA = 'CLEAR_SENSITIVE_DATA';

// Initial state
const initialState = {
    currentStep: 1, // 1: username, 2: secrets, 3: password, 4: totp
    usernameHash: null,
    cryptoKey34: null,
    argon2Salt: null,
    error: null,
    loading: false
};

// Reducer
function authReducer(state = initialState, action) {
    switch (action.type) {
        case SET_LOGIN_STEP:
            return { ...state, currentStep: action.payload };
        case SET_USERNAME_HASH:
            return { ...state, usernameHash: action.payload };
        case SET_CRYPTO_KEY_34:
            return { ...state, cryptoKey34: action.payload };
        case SET_ARGON2_SALT:
            return { ...state, argon2Salt: action.payload };
        case SET_ERROR:
            return { ...state, error: action.payload };
        case SET_LOADING:
            return { ...state, loading: action.payload };
        case CLEAR_SENSITIVE_DATA:
            return {
                ...state,
                usernameHash: null,
                cryptoKey34: null,
                argon2Salt: null
            };
        default:
            return state;
    }
}

// Create store
const authStore = createStore(authReducer);

// Action creators
const authActions = {
    setLoginStep: (step) => ({ type: SET_LOGIN_STEP, payload: step }),
    setUsernameHash: (hash) => ({ type: SET_USERNAME_HASH, payload: hash }),
    setCryptoKey34: (key) => ({ type: SET_CRYPTO_KEY_34, payload: key }),
    setArgon2Salt: (salt) => ({ type: SET_ARGON2_SALT, payload: salt }),
    setError: (error) => ({ type: SET_ERROR, payload: error }),
    setLoading: (isLoading) => ({ type: SET_LOADING, payload: isLoading }),
    clearSensitiveData: () => ({ type: CLEAR_SENSITIVE_DATA })
};
