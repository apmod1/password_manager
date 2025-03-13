// store.js - Redux store configuration
const { combineReducers } = Redux;

// Combine all reducers (currently only auth)
const rootReducer = combineReducers({
    auth: authReducer
});

const store = createStore(rootReducer);
// Redux store configuration
const { createStore, combineReducers } = Redux;
const { Provider } = ReactRedux;

// Import reducers
const vaultReducer = (state = { items: [], loading: false, error: null }, action) => {
  switch (action.type) {
    case 'FETCH_ITEMS_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_ITEMS_SUCCESS':
      return { ...state, items: action.payload, loading: false };
    case 'FETCH_ITEMS_FAILURE':
      return { ...state, error: action.payload, loading: false };
    case 'ADD_ITEM_SUCCESS':
      return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM_SUCCESS':
      return {
        ...state,
        items: state.items.map(item => 
          item.item_id === action.payload.item_id ? action.payload : item
        )
      };
    default:
      return state;
  }
};

// Combine reducers
const rootReducer = combineReducers({
  vault: vaultReducer
});

// Create store
const store = createStore(rootReducer);
