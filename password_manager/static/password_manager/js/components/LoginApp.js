// LoginApp.js - Main component that renders the appropriate login step
const { Provider, useSelector } = ReactRedux;

function LoginApp() {
    const currentStep = useSelector(state => state.auth.currentStep);

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return <LoginUsername />;
            case 2:
                return <LoginSecrets />;
            case 3:
                return <LoginPassword />;
            case 4:
                return <LoginTOTP />;
            default:
                return <LoginUsername />;
        }
    };

    return (
        <div className="login-app">
            {renderCurrentStep()}
        </div>
    );
}

// Render the app
document.addEventListener('DOMContentLoaded', () => {
    ReactDOM.render(
        <Provider store={store}>
            <LoginApp />
        </Provider>,
        document.getElementById('root')
    );
});
