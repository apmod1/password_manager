
class VaultItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isEditing: false,
      decryptedData: null,
      fields: {},
      isLoading: false,
      error: null
    };
  }
  
  componentDidMount() {
    if (this.props.item) {
      this.decryptItem();
    }
  }
  
  componentDidUpdate(prevProps) {
    if (this.props.item && (!prevProps.item || prevProps.item.id !== this.props.item.id)) {
      this.decryptItem();
    }
  }
  
  async decryptItem() {
    this.setState({ isLoading: true, error: null });
    
    try {
      const { item, unwrappedKey, uuid, hmacWords } = this.props;
      
      // Parse encrypted data
      const encryptedData = JSON.parse(item.encrypted_data);
      const decryptedFields = {};
      
      // Generate AAD for verification
      const hmacKey = hmacWords.join(' ');
      const aad = await window.cryptoUtils.generateHMAC(
        hmacKey, 
        window.cryptoUtils.strToUTF8Arr(uuid)
      );
      
      // Decrypt each field
      for (const field in encryptedData) {
        const encryptedBytes = window.cryptoUtils.base64DecToArr(encryptedData[field]);
        const decryptedBytes = await window.cryptoUtils.decryptData(unwrappedKey, encryptedBytes, aad);
        decryptedFields[field] = window.cryptoUtils.UTF8ArrToStr(decryptedBytes);
      }
      
      this.setState({ 
        decryptedData: decryptedFields,
        fields: { ...decryptedFields },
        isLoading: false
      });
    } catch (error) {
      console.error('Error decrypting item:', error);
      this.setState({ 
        error: 'Failed to decrypt item. Invalid key or corrupted data.',
        isLoading: false
      });
    }
  }
  
  handleEditToggle = () => {
    this.setState(prevState => ({ 
      isEditing: !prevState.isEditing,
      fields: { ...this.state.decryptedData }
    }));
  }
  
  handleFieldChange = (fieldName, value) => {
    this.setState(prevState => ({
      fields: {
        ...prevState.fields,
        [fieldName]: value
      }
    }));
  }
  
  handleSave = async () => {
    this.setState({ isLoading: true, error: null });
    
    try {
      const { item, unwrappedKey, uuid, hmacWords, onUpdateItem } = this.props;
      const { fields } = this.state;
      
      // Generate AAD for verification
      const hmacKey = hmacWords.join(' ');
      const aad = await window.cryptoUtils.generateHMAC(
        hmacKey, 
        window.cryptoUtils.strToUTF8Arr(uuid)
      );
      
      // Encrypt each field
      const encryptedFields = {};
      for (const field in fields) {
        const dataBytes = window.cryptoUtils.strToUTF8Arr(fields[field]);
        const encryptedBytes = await window.cryptoUtils.encryptData(unwrappedKey, dataBytes, aad);
        encryptedFields[field] = window.cryptoUtils.base64EncArr(encryptedBytes);
      }
      
      // Prepare updated item
      const updatedItem = {
        ...item,
        encrypted_data: JSON.stringify(encryptedFields),
        name: fields.name || item.name // Use name field or keep existing name
      };
      
      // Call API to update
      await onUpdateItem(updatedItem);
      
      this.setState({ 
        isEditing: false,
        decryptedData: { ...fields },
        isLoading: false
      });
    } catch (error) {
      console.error('Error saving item:', error);
      this.setState({ 
        error: 'Failed to save item. Please try again.',
        isLoading: false
      });
    }
  }
  
  handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await this.props.onDeleteItem(this.props.item.id);
      } catch (error) {
        console.error('Error deleting item:', error);
        this.setState({ 
          error: 'Failed to delete item. Please try again.'
        });
      }
    }
  }
  
  renderViewMode() {
    const { item } = this.props;
    const { decryptedData, error } = this.state;
    
    if (error) {
      return <div className="error-message">{error}</div>;
    }
    
    if (!decryptedData) {
      return <div className="loading">Decrypting...</div>;
    }
    
    return (
      <div className="item-view">
        <h2>{item.name}</h2>
        {Object.entries(decryptedData).map(([field, value]) => (
          field !== 'name' && (
            <div key={field} className="item-field">
              <strong>{field}:</strong> {value}
            </div>
          )
        ))}
        <div className="item-actions">
          <button onClick={this.handleEditToggle}>Edit</button>
          <button onClick={this.handleDelete} className="delete-button">Delete</button>
        </div>
      </div>
    );
  }
  
  renderEditMode() {
    const { fields, isLoading, error } = this.state;
    
    return (
      <div className="item-edit">
        <h2>Edit Item</h2>
        {error && <div className="error-message">{error}</div>}
        
        {Object.entries(fields).map(([field, value]) => (
          <div key={field} className="form-group">
            <label>{field}</label>
            <input
              type={field.includes('password') ? 'password' : 'text'}
              value={value}
              onChange={(e) => this.handleFieldChange(field, e.target.value)}
              disabled={isLoading}
            />
          </div>
        ))}
        
        <div className="item-actions">
          <button onClick={this.handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button onClick={this.handleEditToggle} disabled={isLoading}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  
  render() {
    const { isEditing, isLoading } = this.state;
    
    if (isLoading && !isEditing) {
      return <div className="loading">Loading...</div>;
    }
    
    return (
      <div className="vault-item">
        {isEditing ? this.renderEditMode() : this.renderViewMode()}
      </div>
    );
  }
}

// Connect component to Redux
const mapStateToProps = (state) => ({
  unwrappedKey: state.vault.unwrappedKey,
  hmacWords: state.vault.hmacWords,
  uuid: state.auth.uuid
});

const mapDispatchToProps = (dispatch) => ({
  onUpdateItem: (item) => {
    dispatch(vaultSlice.updateVaultItemStart());
    return fetch(`/vault/items/${item.id}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(item)
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to update item');
      return response.json();
    })
    .then(data => {
      dispatch(vaultSlice.updateVaultItemSuccess(item));
      return data;
    })
    .catch(error => {
      dispatch(vaultSlice.updateVaultItemFailure(error.message));
      throw error;
    });
  },
  onDeleteItem: (itemId) => {
    dispatch(vaultSlice.deleteVaultItemStart());
    return fetch(`/vault/items/${itemId}/`, {
      method: 'DELETE'
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to delete item');
      dispatch(vaultSlice.deleteVaultItemSuccess(itemId));
    })
    .catch(error => {
      dispatch(vaultSlice.deleteVaultItemFailure(error.message));
      throw error;
    });
  }
});

const ConnectedVaultItem = ReactRedux.connect(
  mapStateToProps,
  mapDispatchToProps
)(VaultItem);
