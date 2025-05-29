// Background script for subscription manager

// Handle OAuth
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startOAuth") {
        // Forward the OAuth request to the popup
        if (sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, { action: "startOAuth" });
        }
        sendResponse({ success: true });
        return true; // Keep the message channel open for async response
    }
});

// Handle subscription notifications
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('sub_')) {
        const [_, subscriptionId, type] = alarm.name.split('_');
        
        chrome.storage.local.get(['subscriptions'], (result) => {
            const subscriptions = result.subscriptions || [];
            const subscription = subscriptions.find(sub => sub.id === parseInt(subscriptionId));
            
            if (subscription) {
                let message = '';
                if (type === '1day') {
                    message = `Your subscription "${subscription.name}" will expire tomorrow!`;
                } else if (type === 'expired') {
                    message = `Your subscription "${subscription.name}" has expired today!`;
                }
                
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon128.png',
                    title: 'Subscription Alert',
                    message: message
                });
            }
        });
    }
});

// Function to check for new subscription emails
async function checkForNewSubscriptions() {
    try {
        console.log('Checking for new subscription emails...');
        const { gmailAccessToken } = await chrome.storage.local.get('gmailAccessToken');
        
        if (!gmailAccessToken) {
            console.log('No access token found');
            return;
        }

        const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=10", {
            headers: { 
                Authorization: `Bearer ${gmailAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched messages:', data.messages?.length || 0);

        if (!data.messages || data.messages.length === 0) {
            console.log('No unread messages found');
            // Clear badge if no new subscriptions
            await chrome.action.setBadgeText({ text: '' });
            return;
        }

        const emails = [];
        for (const message of data.messages) {
            try {
                const emailData = await fetchEmailContent(gmailAccessToken, message.id);
                const headers = emailData.payload.headers;
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                const snippet = emailData.snippet || '';
                const sender = getSenderEmail(headers);

                // Check if it's a subscription email
                if (isSubscriptionEmail(subject, snippet)) {
                    emails.push({
                        id: message.id,
                        sender,
                        subject,
                        snippet
                    });
                }
            } catch (error) {
                console.error('Error processing email:', error);
                continue;
            }
        }

        if (emails.length > 0) {
            console.log('Found subscription emails:', emails.length);
            // Store the emails in storage for the popup to read
            await chrome.storage.local.set({ pendingSubscriptions: emails });
            
            // Set badge count
            await chrome.action.setBadgeText({ text: emails.length.toString() });
            await chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
            
            // Try to send to popup if it's open
            try {
                chrome.runtime.sendMessage({
                    type: 'newSubscriptions',
                    emails: emails
                });
            } catch (error) {
                // Popup is not open, which is fine
                console.log('Popup is not open, emails stored for next open');
            }
        } else {
            // Clear badge if no new subscriptions
            await chrome.action.setBadgeText({ text: '' });
        }
    } catch (error) {
        console.error('Error checking for new subscriptions:', error);
    }
}

// Function to fetch email content
async function fetchEmailContent(accessToken, messageId) {
    try {
        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching email content:', error);
        throw error;
    }
}

// Function to get sender email from headers
function getSenderEmail(headers) {
    const fromHeader = headers.find(h => h.name === 'From')?.value || '';
    // Extract email from "Name <email@example.com>" format
    const emailMatch = fromHeader.match(/<(.+?)>/) || fromHeader.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return emailMatch ? emailMatch[1] : fromHeader;
}

// Function to check if an email is subscription-related
function isSubscriptionEmail(subject, snippet) {
    const text = (subject + ' ' + snippet).toLowerCase();
    const subscriptionKeywords = [
        'subscription',
        'subscribe',
        'newsletter',
        'confirm your subscription',
        'welcome to',
        'your account',
        'verify your email',
        'confirm your email',
        'subscription confirmed',
        'subscription activated',
        'subscription started',
        'subscription payment',
        'subscription receipt',
        'subscription renewal',
        'subscription order',
        'subscription purchase',
        'subscription successful'
    ];

    return subscriptionKeywords.some(keyword => text.includes(keyword.toLowerCase()));
}

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
    // Check immediately
    checkForNewSubscriptions();
    // Then check every 5 minutes
    setInterval(checkForNewSubscriptions, 5 * 60 * 1000);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'checkSubscriptions') {
        checkForNewSubscriptions().then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            console.error('Error checking subscriptions:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep the message channel open for async response
    }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener(() => {
    console.log('Notification clicked, opening popup...');
    // Open the popup
    chrome.action.openPopup();
});

// Check for new subscription emails periodically
chrome.alarms.create('checkSubscriptions', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkSubscriptions') {
        await checkForNewSubscriptions();
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkSubscriptions') {
        // Trigger the check immediately
        chrome.alarms.create('checkSubscriptions', { when: Date.now() + 100 });
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkNewEmails') {
        checkNewEmails();
    }
});

// Check for new emails
async function checkNewEmails() {
    try {
        const { gmailAccessToken } = await chrome.storage.local.get('gmailAccessToken');
        if (!gmailAccessToken) {
            console.log('No access token found');
            return;
        }

        // Get the last checked email ID
        const { lastCheckedEmailId } = await chrome.storage.local.get('lastCheckedEmailId');

        // Fetch new emails
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
            headers: {
                'Authorization': `Bearer ${gmailAccessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch emails');
        }

        const data = await response.json();
        const messages = data.messages || [];

        // Process new emails
        for (const message of messages) {
            // Skip if we've already processed this email
            if (lastCheckedEmailId === message.id) {
                break;
            }

            // Get email details
            const emailResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
                headers: {
                    'Authorization': `Bearer ${gmailAccessToken}`
                }
            });

            if (!emailResponse.ok) {
                continue;
            }

            const emailData = await emailResponse.json();
            const headers = emailData.payload.headers;
            
            // Extract sender and subject
            const sender = headers.find(h => h.name === 'From')?.value || '';
            const subject = headers.find(h => h.name === 'Subject')?.value || '';

            // Check if this might be a subscription email
            if (isPotentialSubscription(sender, subject)) {
                // Show notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon128.png',
                    title: 'New Possible Subscription',
                    message: `From: ${sender}\nSubject: ${subject}`,
                    buttons: [
                        { title: 'Add Subscription' }
                    ]
                });
            }
        }

        // Update last checked email ID
        if (messages.length > 0) {
            await chrome.storage.local.set({ lastCheckedEmailId: messages[0].id });
        }
    } catch (error) {
        console.error('Error checking for new emails:', error);
    }
}

// Check if an email might be a subscription
function isPotentialSubscription(sender, subject) {
    const subscriptionKeywords = [
        'subscription',
        'subscribe',
        'newsletter',
        'confirm your subscription',
        'welcome to',
        'your account',
        'verify your email',
        'confirm your email'
    ];

    const lowerSubject = subject.toLowerCase();
    const lowerSender = sender.toLowerCase();

    return subscriptionKeywords.some(keyword => 
        lowerSubject.includes(keyword) || lowerSender.includes(keyword)
    );
}

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) { // "Add Subscription" button
        // Open popup to add subscription
        chrome.action.openPopup();
    }
});
