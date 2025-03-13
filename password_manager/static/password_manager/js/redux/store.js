// store.js - Redux store configuration
const { combineReducers } = Redux;

// Combine all reducers (currently only auth)
const rootReducer = combineReducers({
    auth: authReducer
});

const store = createStore(rootReducer);
