// Import functions from oauth.js
let initializeAuth, checkAuthStatus, startOAuth, fetchEmails;

// Load the modules
async function loadModules() {
    try {
        const oauthModule = await import('./oauth.js');
        const fetchModule = await import('./fetchemails.js');
        
        initializeAuth = oauthModule.initializeAuth;
        checkAuthStatus = oauthModule.checkAuthStatus;
        startOAuth = oauthModule.startOAuth;
        fetchEmails = fetchModule.fetchEmails;
        
        return true;
    } catch (error) {
        console.error('Error loading modules:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load modules first
    const modulesLoaded = await loadModules();
    if (!modulesLoaded) {
        console.error('Failed to load required modules');
        return;
    }

    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const statusText = document.getElementById('statusText');
    const activeSubscriptions = document.getElementById('activeSubscriptions');
    const suggestedSubscriptions = document.getElementById('suggestedSubscriptions');
    const loginSection = document.getElementById('loginSection');
    const subscriptionSection = document.getElementById('subscriptionSection');
    const errorMessage = document.getElementById('errorMessage');
    const subscriptionName = document.getElementById('subscriptionName');
    const subscriptionEndDate = document.getElementById('subscriptionEndDate');
    const addManualSubscription = document.getElementById('addManualSubscription');

    // Modal elements
    const durationModal = document.getElementById('durationModal');
    const modalSubscriptionName = document.getElementById('modalSubscriptionName');
    const modalEndDate = document.getElementById('modalEndDate');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');

    // Current suggestion being processed
    let currentSuggestion = null;

    // Initialize UI
    try {
        const isAuthenticated = await initializeAuth();
        updateUI(isAuthenticated);
        
        if (isAuthenticated) {
            // Clear the badge when popup is opened
            await chrome.action.setBadgeText({ text: '' });
            
            // Check for pending subscriptions
            const { pendingSubscriptions } = await chrome.storage.local.get('pendingSubscriptions');
            if (pendingSubscriptions && pendingSubscriptions.length > 0) {
                displayNewSubscriptions(pendingSubscriptions);
                // Clear pending subscriptions after displaying them
                await chrome.storage.local.remove('pendingSubscriptions');
            } else {
                loadAllSubscriptions();
            }
        }
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Failed to initialize popup');
    }

    // Modal event handlers
    modalCancel.addEventListener('click', () => {
        durationModal.style.display = 'none';
        currentSuggestion = null;
        modalSubscriptionName.value = '';
        modalEndDate.value = '';
    });

    modalConfirm.addEventListener('click', async () => {
        if (!currentSuggestion) return;

        const name = modalSubscriptionName.value.trim();
        const endDate = new Date(modalEndDate.value);

        if (!name || !endDate || isNaN(endDate.getTime())) {
            showError('Please fill in both name and end date fields');
            return;
        }

        try {
            // Get existing subscriptions
            const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
            
            // Add new subscription with specified end date
            subscriptions.push({
                name,
                startDate: new Date().toISOString(),
                endDate: endDate.toISOString()
            });

            // Save updated subscriptions
            await chrome.storage.local.set({ subscriptions });
            
            // Remove from suggestions
            const { suggestedSubscriptions = [] } = await chrome.storage.local.get('suggestedSubscriptions');
            const updatedSuggestions = suggestedSubscriptions.filter(s => s.id !== currentSuggestion.id);
            await chrome.storage.local.set({ suggestedSubscriptions: updatedSuggestions });
            
            // Update both displays
            displayActiveSubscriptions();
            displayNewSubscriptions(updatedSuggestions);
            
            // Close modal and reset
            durationModal.style.display = 'none';
            currentSuggestion = null;
            modalSubscriptionName.value = '';
            modalEndDate.value = '';
            
            showError('Subscription added successfully!');
        } catch (error) {
            console.error('Error adding subscription:', error);
            showError('Failed to add subscription');
        }
    });

    // Login button click handler
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            try {
                console.log('Login button clicked');
                loginButton.disabled = true;
                loginButton.textContent = 'Logging in...';
                if (errorMessage) errorMessage.textContent = '';
                
                console.log('Starting OAuth process...');
                const token = await startOAuth();
                console.log('OAuth token received:', token ? 'Yes' : 'No');
                
                if (token) {
                    console.log('Checking auth status...');
                    const isAuthenticated = await checkAuthStatus();
                    console.log('Auth status:', isAuthenticated);
                    
                    updateUI(isAuthenticated);
                    if (isAuthenticated) {
                        console.log('Loading subscriptions...');
                        loadAllSubscriptions();
                    } else {
                        console.log('Not authenticated after token received');
                        showError('Login failed: Authentication check failed');
                    }
                } else {
                    console.log('No token received from OAuth');
                    showError('Login failed: No token received');
                }
            } catch (error) {
                console.error('Login error details:', error);
                showError('Login failed: ' + (error.message || 'Unknown error'));
                updateUI(false);
            } finally {
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login with Google';
                }
            }
        });
    }

    // Logout button click handler
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await chrome.storage.local.remove('gmailAccessToken');
                updateUI(false);
                showError('Successfully logged out');
            } catch (error) {
                console.error('Error during logout:', error);
                showError('Failed to logout. Please try again.');
            }
        });
    }

    // Add manual subscription handler
    if (addManualSubscription) {
        addManualSubscription.addEventListener('click', async () => {
            const name = subscriptionName.value.trim();
            const endDate = new Date(subscriptionEndDate.value);

            if (!name || !endDate || isNaN(endDate.getTime())) {
                showError('Please fill in both name and end date fields');
                return;
            }

            try {
                // Get existing subscriptions
                const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
                
                // Add new subscription
                subscriptions.push({
                    name,
                    startDate: new Date().toISOString(),
                    endDate: endDate.toISOString()
                });

                // Save updated subscriptions
                await chrome.storage.local.set({ subscriptions });
                
                // Clear input fields
                subscriptionName.value = '';
                subscriptionEndDate.value = '';
                
                showError('Subscription added successfully!');
                loadAllSubscriptions();
            } catch (error) {
                console.error('Error adding subscription:', error);
                showError('Failed to add subscription');
            }
        });
    }

    // Update UI based on authentication status
    function updateUI(isAuthenticated) {
        if (loginSection) loginSection.style.display = isAuthenticated ? 'none' : 'block';
        if (subscriptionSection) subscriptionSection.style.display = isAuthenticated ? 'block' : 'none';
        if (errorMessage) errorMessage.textContent = '';
        if (loginButton) loginButton.style.display = isAuthenticated ? 'none' : 'block';
        if (logoutButton) logoutButton.style.display = isAuthenticated ? 'block' : 'none';
        if (statusText) statusText.textContent = isAuthenticated ? 'Logged in' : 'Not logged in';
    }

    // Show error message
    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            setTimeout(() => {
                if (errorMessage) {
                    errorMessage.style.display = 'none';
                }
            }, 5000);
        }
    }

    // Format date for display
    function formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    // Calculate duration
    function calculateDuration(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();
        
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        
        return {
            total: totalDays,
            remaining: remainingDays,
            isExpired: remainingDays < 0
        };
    }

    // Display active subscriptions
    async function displayActiveSubscriptions() {
        if (!activeSubscriptions) return;

        const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
        
        if (subscriptions.length === 0) {
            activeSubscriptions.innerHTML = '<p>No active subscriptions</p>';
            return;
        }

        activeSubscriptions.innerHTML = '';
        subscriptions.forEach(sub => {
            const duration = calculateDuration(sub.startDate, sub.endDate);
            const div = document.createElement('div');
            div.className = 'subscription-item';
            div.innerHTML = `
                <div class="subscription-info">
                    <div><strong>${sub.name}</strong></div>
                    <div class="duration-info ${duration.isExpired ? 'expired' : ''}">
                        ${duration.isExpired ? 'Expired' : `${duration.remaining} days remaining`}
                        <br>
                        <small>Started: ${formatDate(sub.startDate)} - Ends: ${formatDate(sub.endDate)}</small>
                    </div>
                </div>
                <div class="button-group">
                    <button class="remove-btn" data-id="${sub.name}">Remove</button>
                </div>
            `;
            activeSubscriptions.appendChild(div);
        });

        // Add click handlers for Remove buttons
        activeSubscriptions.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const name = button.dataset.id;
                const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
                const updatedSubscriptions = subscriptions.filter(sub => sub.name !== name);
                await chrome.storage.local.set({ subscriptions: updatedSubscriptions });
                displayActiveSubscriptions();
            });
        });
    }

    // Display new subscriptions in the UI
    function displayNewSubscriptions(emails) {
        if (!suggestedSubscriptions) return;

        if (!emails || emails.length === 0) {
            suggestedSubscriptions.innerHTML = '<p>No new subscription suggestions found</p>';
            return;
        }

        console.log('Displaying emails in UI:', emails);

        // Get existing suggestions from storage
        chrome.storage.local.get(['suggestedSubscriptions'], async (result) => {
            const existingSuggestions = result.suggestedSubscriptions || [];
            const allSuggestions = [...existingSuggestions, ...emails];
            
            // Remove duplicates based on email ID
            const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) =>
                index === self.findIndex((s) => s.id === suggestion.id)
            );

            // Save updated suggestions
            await chrome.storage.local.set({ suggestedSubscriptions: uniqueSuggestions });

            // Display all suggestions
            suggestedSubscriptions.innerHTML = '';
            uniqueSuggestions.forEach(email => {
                const div = document.createElement('div');
                div.className = 'subscription-item';
                div.innerHTML = `
                    <div class="subscription-info">
                        <div><strong>${email.sender}</strong></div>
                        <div class="sender-info">${email.subject}</div>
                    </div>
                    <div class="button-group">
                        <button class="add-btn" data-sender="${email.sender}" data-id="${email.id}">Add</button>
                        <button class="remove-btn" data-id="${email.id}">Remove</button>
                    </div>
                `;
                suggestedSubscriptions.appendChild(div);
            });

            // Add click handlers for the Add buttons
            suggestedSubscriptions.querySelectorAll('.add-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const sender = button.dataset.sender;
                    const id = button.dataset.id;
                    const name = sender.split('@')[0]; // Use email username as default name
                    
                    // Find the suggestion
                    const suggestion = uniqueSuggestions.find(s => s.id === id);
                    if (suggestion) {
                        currentSuggestion = suggestion;
                        modalSubscriptionName.value = name;
                        
                        // Set default end date to 30 days from now
                        const defaultEndDate = new Date();
                        defaultEndDate.setDate(defaultEndDate.getDate() + 30);
                        modalEndDate.value = defaultEndDate.toISOString().split('T')[0];
                        
                        durationModal.style.display = 'block';
                    }
                });
            });

            // Add click handlers for Remove buttons
            suggestedSubscriptions.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const id = button.dataset.id;
                    const { suggestedSubscriptions = [] } = await chrome.storage.local.get('suggestedSubscriptions');
                    const updatedSuggestions = suggestedSubscriptions.filter(s => s.id !== id);
                    await chrome.storage.local.set({ suggestedSubscriptions: updatedSuggestions });
                    displayNewSubscriptions(updatedSuggestions);
                });
            });
        });
    }

    // Load all subscriptions
    async function loadAllSubscriptions() {
        await displayActiveSubscriptions();
        const { suggestedSubscriptions = [] } = await chrome.storage.local.get('suggestedSubscriptions');
        displayNewSubscriptions(suggestedSubscriptions);
    }
});
