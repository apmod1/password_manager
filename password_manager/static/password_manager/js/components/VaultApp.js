
// Main Vault App Component
const VaultApp = () => {
  const { useState, useEffect } = React;
  const { useSelector, useDispatch } = ReactRedux;
  
  const dispatch = useDispatch();
  const { items, loading, error } = useSelector(state => state.vault);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    // Fetch vault items when component mounts
    fetchItems();
  }, []);

  const fetchItems = async () => {
    dispatch({ type: 'FETCH_ITEMS_REQUEST' });
    try {
      const response = await fetch('/password_manager/vault/items/');
      if (!response.ok) throw new Error('Failed to fetch items');
      
      const data = await response.json();
      dispatch({ type: 'FETCH_ITEMS_SUCCESS', payload: data });
    } catch (error) {
      dispatch({ type: 'FETCH_ITEMS_FAILURE', payload: error.message });
    }
  };

  return (
    <div className="vault-container">
      <h1>Secure Password Vault</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <button 
        className="create-button"
        onClick={() => setShowCreateForm(true)}
      >
        Create New Item
      </button>
      
      {loading ? (
        <div className="loading">Loading vault items...</div>
      ) : (
        <VaultList 
          items={items} 
          onItemSelect={setSelectedItem} 
        />
      )}
      
      {showCreateForm && (
        <CreateItem 
          onClose={() => setShowCreateForm(false)}
          onCreateSuccess={(newItem) => {
            dispatch({ type: 'ADD_ITEM_SUCCESS', payload: newItem });
            setShowCreateForm(false);
          }}
        />
      )}
      
      {selectedItem && (
        <VaultItem 
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdateSuccess={(updatedItem) => {
            dispatch({ type: 'UPDATE_ITEM_SUCCESS', payload: updatedItem });
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
};

// Render the app
ReactDOM.render(
  <ReactRedux.Provider store={store}>
    <VaultApp />
  </ReactRedux.Provider>,
  document.getElementById('root')
);
