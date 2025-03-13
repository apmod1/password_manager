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
