// VaultList.js - Component to display the list of vault items
const { useSelector, useDispatch } = ReactRedux;

function VaultList() {
    const items = useSelector(state => state.items);
    const loading = useSelector(state => state.loading);
    const error = useSelector(state => state.error);
    const filter = useSelector(state => state.filter);
    const searchQuery = useSelector(state => state.searchQuery);
    const dispatch = useDispatch();

    // Fetch vault items when component mounts
    React.useEffect(() => {
        fetchItems();
    }, []);

    async function fetchItems() {
        dispatch(vaultActions.fetchVaultItemsRequest());

        try {
            // Retrieve items from IndexedDB
            const db = await openDatabase('vaultDB', 1);
            const transaction = db.transaction(['vault'], 'readonly');
            const store = transaction.objectStore('vault');
            const request = store.getAll();

            request.onsuccess = function (event) {
                const vaultItems = event.target.result;
                dispatch(vaultActions.fetchVaultItemsSuccess(vaultItems));
            };

            request.onerror = function (event) {
                dispatch(vaultActions.fetchVaultItemsFailure('Failed to fetch vault items'));
                console.error('IndexedDB error:', event.target.error);
            };
        } catch (error) {
            dispatch(vaultActions.fetchVaultItemsFailure(error.message));
            console.error('Error fetching vault items:', error);
        }
    }

    function handleCreateNew() {
        dispatch(vaultActions.clearCurrentItem());
        document.getElementById('create-item-modal').style.display = 'block';
    }

    function handleEditItem(item) {
        dispatch(vaultActions.setCurrentItem(item));
        document.getElementById('edit-item-modal').style.display = 'block';
    }

    async function handleDeleteItem(itemId) {
        if (!confirm('Are you sure you want to delete this item?')) return;

        dispatch(vaultActions.deleteItemRequest());

        try {
            // Delete from IndexedDB
            const db = await openDatabase('vaultDB', 1);
            const transaction = db.transaction(['vault'], 'readwrite');
            const store = transaction.objectStore('vault');
            const request = store.delete(itemId);

            request.onsuccess = function () {
                dispatch(vaultActions.deleteItemSuccess(itemId));
            };

            request.onerror = function (event) {
                dispatch(vaultActions.deleteItemFailure('Failed to delete item'));
                console.error('IndexedDB error:', event.target.error);
            };

            // Send delete request to server
            const uuid = localStorage.getItem('uuid');
            const usernameHash = localStorage.getItem('usernameHash');

            if (uuid && usernameHash) {
                const payload = {
                    uuid: uuid,
                    username_hash: usernameHash,
                    item_id: itemId
                };

                // Get HMAC key from IndexedDB
                const keysStore = transaction.objectStore('keys');
                const hmacKeyRequest = keysStore.get('hmacKey');

                hmacKeyRequest.onsuccess = async function (event) {
                    const hmacKey = event.target.result;

                    if (hmacKey) {
                        // Generate HMAC
                        const hmacAlgorithm = { name: 'HMAC', hash: 'SHA-256' };
                        const hmacKeyObj = await window.crypto.subtle.importKey(
                            'raw',
                            hmacKey,
                            hmacAlgorithm,
                            false,
                            ['sign']
                        );

                        const encoder = new TextEncoder();
                        const hmacSignature = await window.crypto.subtle.sign(
                            hmacAlgorithm,
                            hmacKeyObj,
                            encoder.encode(JSON.stringify(payload))
                        );

                        // Convert to Base64
                        const hmacBase64 = base64EncArr(new Uint8Array(hmacSignature));

                        // Send to server
                        await fetch('/password_manager/vault/items/' + itemId + '/', {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-HMAC': hmacBase64
                            },
                            body: JSON.stringify(payload)
                        });
                    }
                };
            }
        } catch (error) {
            dispatch(vaultActions.deleteItemFailure(error.message));
            console.error('Error deleting item:', error);
        }
    }

    function handleSearchChange(e) {
        dispatch(vaultActions.setSearchQuery(e.target.value));
    }

    function handleFilterChange(e) {
        dispatch(vaultActions.setFilter(e.target.value));
    }

    // Filter and search items
    const filteredItems = items.filter(item => {
        // Apply type filter
        if (filter !== 'all' && item.type !== filter) return false;

        // Apply search
        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

        return true;
    });

    function renderItems() {
        if (loading) return <div className="loading">Loading vault items...</div>;
        if (error) return <div className="error-message">{error}</div>;
        if (filteredItems.length === 0) {
            if (items.length === 0) {
                return <div className="empty-state">No items in vault. Create your first secure entry!</div>;
            } else {
                return <div className="empty-state">No items match your search or filter criteria.</div>;
            }
        }

        return (
            <div className="vault-items-list">
                {filteredItems.map(item => (
                    <div key={item.id} className="vault-item-card">
                        <div className="vault-item-header">
                            <h3>{item.name}</h3>
                            <div className="vault-item-actions">
                                <button
                                    onClick={() => handleEditItem(item)}
                                    className="btn icon-btn edit-btn"
                                    aria-label="Edit item"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="btn icon-btn delete-btn"
                                    aria-label="Delete item"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div className="vault-item-meta">
                            <span className="item-type">{item.type}</span>
                            <span className="item-date">Last updated: {new Date(item.updated_at).toLocaleDateString()}</span>
                        </div>
                        <button
                            className="btn view-btn"
                            onClick={() => handleEditItem(item)}
                        >
                            View Details
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="vault-list-container">
            <div className="vault-header">
                <h1>Secure Password Vault</h1>
                <button
                    onClick={handleCreateNew}
                    className="btn primary create-btn"
                >
                    Create New Item
                </button>
            </div>

            <div className="vault-toolbar">
                <input
                    type="text"
                    placeholder="Search vault..."
                    className="search-input"
                    value={searchQuery}
                    onChange={handleSearchChange}
                />
                <select
                    className="filter-select"
                    value={filter}
                    onChange={handleFilterChange}
                >
                    <option value="all">All Items</option>
                    <option value="password">Passwords</option>
                    <option value="card">Credit Cards</option>
                    <option value="note">Secure Notes</option>
                </select>
                <button onClick={fetchItems} className="btn refresh-btn">
                    Refresh
                </button>
            </div>

            {renderItems()}
        </div>
    );
}
