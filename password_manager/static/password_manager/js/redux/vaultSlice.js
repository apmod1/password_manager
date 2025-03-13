// vaultSlice.js - Redux state management for vault items
const { createStore } = Redux;

// Action types
const FETCH_VAULT_ITEMS_REQUEST = 'FETCH_VAULT_ITEMS_REQUEST';
const FETCH_VAULT_ITEMS_SUCCESS = 'FETCH_VAULT_ITEMS_SUCCESS';
const FETCH_VAULT_ITEMS_FAILURE = 'FETCH_VAULT_ITEMS_FAILURE';
const CREATE_ITEM_REQUEST = 'CREATE_ITEM_REQUEST';
const CREATE_ITEM_SUCCESS = 'CREATE_ITEM_SUCCESS';
const CREATE_ITEM_FAILURE = 'CREATE_ITEM_FAILURE';
const UPDATE_ITEM_REQUEST = 'UPDATE_ITEM_REQUEST';
const UPDATE_ITEM_SUCCESS = 'UPDATE_ITEM_SUCCESS';
const UPDATE_ITEM_FAILURE = 'UPDATE_ITEM_FAILURE';
const DELETE_ITEM_REQUEST = 'DELETE_ITEM_REQUEST';
const DELETE_ITEM_SUCCESS = 'DELETE_ITEM_SUCCESS';
const DELETE_ITEM_FAILURE = 'DELETE_ITEM_FAILURE';
const SET_CURRENT_ITEM = 'SET_CURRENT_ITEM';
const CLEAR_CURRENT_ITEM = 'CLEAR_CURRENT_ITEM';
const SET_ERROR = 'SET_ERROR';
const CLEAR_ERROR = 'CLEAR_ERROR';
const SET_LOADING = 'SET_LOADING';
const SET_FILTER = 'SET_FILTER';
const SET_SEARCH_QUERY = 'SET_SEARCH_QUERY';

// Initial state
const initialState = {
    items: [],
    currentItem: null,
    loading: false,
    error: null,
    filter: 'all',
    searchQuery: '',
    uuid: null,
    username: null
};

// Reducer
function vaultReducer(state = initialState, action) {
    switch (action.type) {
        case FETCH_VAULT_ITEMS_REQUEST:
        case CREATE_ITEM_REQUEST:
        case UPDATE_ITEM_REQUEST:
        case DELETE_ITEM_REQUEST:
            return { ...state, loading: true, error: null };
        case FETCH_VAULT_ITEMS_SUCCESS:
            return { ...state, items: action.payload, loading: false };
        case CREATE_ITEM_SUCCESS:
            return {
                ...state,
                items: [...state.items, action.payload],
                currentItem: null,
                loading: false
            };
        case UPDATE_ITEM_SUCCESS:
            return {
                ...state,
                items: state.items.map(item =>
                    item.id === action.payload.id ? action.payload : item
                ),
                currentItem: null,
                loading: false
            };
        case DELETE_ITEM_SUCCESS:
            return {
                ...state,
                items: state.items.filter(item => item.id !== action.payload),
                loading: false
            };
        case FETCH_VAULT_ITEMS_FAILURE:
        case CREATE_ITEM_FAILURE:
        case UPDATE_ITEM_FAILURE:
        case DELETE_ITEM_FAILURE:
            return { ...state, error: action.payload, loading: false };
        case SET_CURRENT_ITEM:
            return { ...state, currentItem: action.payload };
        case CLEAR_CURRENT_ITEM:
            return { ...state, currentItem: null };
        case SET_ERROR:
            return { ...state, error: action.payload };
        case CLEAR_ERROR:
            return { ...state, error: null };
        case SET_LOADING:
            return { ...state, loading: action.payload };
        case SET_FILTER:
            return { ...state, filter: action.payload };
        case SET_SEARCH_QUERY:
            return { ...state, searchQuery: action.payload };
        default:
            return state;
    }
}

// Create store
const vaultStore = createStore(vaultReducer);

// Action creators
const vaultActions = {
    fetchVaultItemsRequest: () => ({ type: FETCH_VAULT_ITEMS_REQUEST }),
    fetchVaultItemsSuccess: (items) => ({ type: FETCH_VAULT_ITEMS_SUCCESS, payload: items }),
    fetchVaultItemsFailure: (error) => ({ type: FETCH_VAULT_ITEMS_FAILURE, payload: error }),
    createItemRequest: () => ({ type: CREATE_ITEM_REQUEST }),
    createItemSuccess: (item) => ({ type: CREATE_ITEM_SUCCESS, payload: item }),
    createItemFailure: (error) => ({ type: CREATE_ITEM_FAILURE, payload: error }),
    updateItemRequest: () => ({ type: UPDATE_ITEM_REQUEST }),
    updateItemSuccess: (item) => ({ type: UPDATE_ITEM_SUCCESS, payload: item }),
    updateItemFailure: (error) => ({ type: UPDATE_ITEM_FAILURE, payload: error }),
    deleteItemRequest: () => ({ type: DELETE_ITEM_REQUEST }),
    deleteItemSuccess: (id) => ({ type: DELETE_ITEM_SUCCESS, payload: id }),
    deleteItemFailure: (error) => ({ type: DELETE_ITEM_FAILURE, payload: error }),
    setCurrentItem: (item) => ({ type: SET_CURRENT_ITEM, payload: item }),
    clearCurrentItem: () => ({ type: CLEAR_CURRENT_ITEM }),
    setError: (error) => ({ type: SET_ERROR, payload: error }),
    clearError: () => ({ type: CLEAR_ERROR }),
    setLoading: (isLoading) => ({ type: SET_LOADING, payload: isLoading }),
    setFilter: (filter) => ({ type: SET_FILTER, payload: filter }),
    setSearchQuery: (query) => ({ type: SET_SEARCH_QUERY, payload: query })
};
/**
 * Redux slice for vault management
 */

const initialState = {
  vaultItems: [],
  currentItem: null,
  isLoading: false,
  error: null,
  unwrappedKey: null, // This will be securely derived after login
  hmacWords: null, // The 5 words used for HMAC generation
};

const vaultSlice = {
  actions: {
    fetchVaultItemsStart: 'vault/fetchVaultItemsStart',
    fetchVaultItemsSuccess: 'vault/fetchVaultItemsSuccess',
    fetchVaultItemsFailure: 'vault/fetchVaultItemsFailure',
    selectVaultItem: 'vault/selectVaultItem',
    createVaultItemStart: 'vault/createVaultItemStart',
    createVaultItemSuccess: 'vault/createVaultItemSuccess',
    createVaultItemFailure: 'vault/createVaultItemFailure',
    updateVaultItemStart: 'vault/updateVaultItemStart',
    updateVaultItemSuccess: 'vault/updateVaultItemSuccess',
    updateVaultItemFailure: 'vault/updateVaultItemFailure',
    deleteVaultItemStart: 'vault/deleteVaultItemStart',
    deleteVaultItemSuccess: 'vault/deleteVaultItemSuccess',
    deleteVaultItemFailure: 'vault/deleteVaultItemFailure',
    setUnwrappedKey: 'vault/setUnwrappedKey',
    setHmacWords: 'vault/setHmacWords',
    clearVault: 'vault/clearVault',
  },
  
  // Action creators
  fetchVaultItemsStart: () => ({ type: vaultSlice.actions.fetchVaultItemsStart }),
  fetchVaultItemsSuccess: (items) => ({ 
    type: vaultSlice.actions.fetchVaultItemsSuccess, 
    payload: items 
  }),
  fetchVaultItemsFailure: (error) => ({ 
    type: vaultSlice.actions.fetchVaultItemsFailure, 
    payload: error 
  }),
  
  selectVaultItem: (item) => ({ 
    type: vaultSlice.actions.selectVaultItem, 
    payload: item 
  }),
  
  createVaultItemStart: () => ({ type: vaultSlice.actions.createVaultItemStart }),
  createVaultItemSuccess: (item) => ({ 
    type: vaultSlice.actions.createVaultItemSuccess, 
    payload: item 
  }),
  createVaultItemFailure: (error) => ({ 
    type: vaultSlice.actions.createVaultItemFailure, 
    payload: error 
  }),
  
  updateVaultItemStart: () => ({ type: vaultSlice.actions.updateVaultItemStart }),
  updateVaultItemSuccess: (item) => ({ 
    type: vaultSlice.actions.updateVaultItemSuccess, 
    payload: item 
  }),
  updateVaultItemFailure: (error) => ({ 
    type: vaultSlice.actions.updateVaultItemFailure, 
    payload: error 
  }),
  
  deleteVaultItemStart: () => ({ type: vaultSlice.actions.deleteVaultItemStart }),
  deleteVaultItemSuccess: (itemId) => ({ 
    type: vaultSlice.actions.deleteVaultItemSuccess, 
    payload: itemId 
  }),
  deleteVaultItemFailure: (error) => ({ 
    type: vaultSlice.actions.deleteVaultItemFailure, 
    payload: error 
  }),
  
  setUnwrappedKey: (key) => ({ 
    type: vaultSlice.actions.setUnwrappedKey, 
    payload: key 
  }),
  
  setHmacWords: (words) => ({ 
    type: vaultSlice.actions.setHmacWords, 
    payload: words 
  }),
  
  clearVault: () => ({ type: vaultSlice.actions.clearVault }),
  
  // Reducer
  reducer: function(state = initialState, action) {
    switch (action.type) {
      case vaultSlice.actions.fetchVaultItemsStart:
        return {
          ...state,
          isLoading: true,
          error: null
        };
      case vaultSlice.actions.fetchVaultItemsSuccess:
        return {
          ...state,
          vaultItems: action.payload,
          isLoading: false,
          error: null
        };
      case vaultSlice.actions.fetchVaultItemsFailure:
        return {
          ...state,
          isLoading: false,
          error: action.payload
        };
      case vaultSlice.actions.selectVaultItem:
        return {
          ...state,
          currentItem: action.payload
        };
      case vaultSlice.actions.createVaultItemStart:
        return {
          ...state,
          isLoading: true,
          error: null
        };
      case vaultSlice.actions.createVaultItemSuccess:
        return {
          ...state,
          vaultItems: [...state.vaultItems, action.payload],
          isLoading: false,
          error: null
        };
      case vaultSlice.actions.createVaultItemFailure:
        return {
          ...state,
          isLoading: false,
          error: action.payload
        };
      case vaultSlice.actions.updateVaultItemStart:
        return {
          ...state,
          isLoading: true,
          error: null
        };
      case vaultSlice.actions.updateVaultItemSuccess:
        return {
          ...state,
          vaultItems: state.vaultItems.map(item => 
            item.id === action.payload.id ? action.payload : item
          ),
          currentItem: action.payload,
          isLoading: false,
          error: null
        };
      case vaultSlice.actions.updateVaultItemFailure:
        return {
          ...state,
          isLoading: false,
          error: action.payload
        };
      case vaultSlice.actions.deleteVaultItemStart:
        return {
          ...state,
          isLoading: true,
          error: null
        };
      case vaultSlice.actions.deleteVaultItemSuccess:
        return {
          ...state,
          vaultItems: state.vaultItems.filter(item => item.id !== action.payload),
          currentItem: state.currentItem && state.currentItem.id === action.payload ? null : state.currentItem,
          isLoading: false,
          error: null
        };
      case vaultSlice.actions.deleteVaultItemFailure:
        return {
          ...state,
          isLoading: false,
          error: action.payload
        };
      case vaultSlice.actions.setUnwrappedKey:
        return {
          ...state,
          unwrappedKey: action.payload
        };
      case vaultSlice.actions.setHmacWords:
        return {
          ...state,
          hmacWords: action.payload
        };
      case vaultSlice.actions.clearVault:
        return {
          ...initialState
        };
      default:
        return state;
    }
  }
};
