// Keywords that might indicate a subscription email
const SUBSCRIPTION_KEYWORDS = [
    // Account confirmation keywords
    'confirm your account',
    'verify your account',
    'account confirmation',
    'account verification',
    'confirm your email',
    'verify your email',
    'email confirmation',
    'email verification',
    'welcome to',
    'get started with',
    'complete your registration',
    'activate your account',
    'please confirm',
    'please verify',
    'confirm your registration',
    'verify your registration',
    
    // Existing subscription keywords
    'subscription',
    'subscription confirmation',
    'subscription activated',
    'subscription started',
    'subscription payment',
    'subscription receipt',
    'subscription renewal',
    'subscription order',
    'subscription purchase',
    'subscription successful',
    'subscription confirmed',
    'subscription active',
    'subscription started',
    'subscription created',
    'subscription setup',
    'subscription activated',
    'subscription payment confirmed',
    'subscription payment successful',
    'subscription payment received',
    'subscription payment processed'
];

// Function to check if an email is subscription-related
function isSubscriptionEmail(subject, snippet) {
    const text = (subject + ' ' + snippet).toLowerCase();
    console.log('Checking email:', { subject, snippet });
    const isMatch = SUBSCRIPTION_KEYWORDS.some(keyword => {
        const matches = text.includes(keyword.toLowerCase());
        if (matches) {
            console.log('Found matching keyword:', keyword);
        }
        return matches;
    });
    console.log('Is subscription email:', isMatch);
    return isMatch;
}

// Function to extract potential subscription name from email
function extractSubscriptionName(subject, snippet) {
    console.log('Extracting subscription name from:', { subject, snippet });
    
    // Common patterns in subscription emails
    const patterns = [
        // Account confirmation patterns
        /welcome to (.+?)(?:!|\.|$)/i,
        /get started with (.+?)(?:!|\.|$)/i,
        /complete your (.+?) registration/i,
        /activate your (.+?) account/i,
        /confirm your (.+?) account/i,
        /verify your (.+?) account/i,
        /please confirm your (.+?) account/i,
        /please verify your (.+?) account/i,
        
        // Subscription patterns
        /subscription to (.+?) (?:has been|is now|was) (?:activated|confirmed|started)/i,
        /your (.+?) subscription (?:has been|is now|was) (?:activated|confirmed|started)/i,
        /(.+?) subscription (?:has been|is now|was) (?:activated|confirmed|started)/i,
        /subscription for (.+?) (?:has been|is now|was) (?:activated|confirmed|started)/i
    ];

    for (const pattern of patterns) {
        const match = (subject + ' ' + snippet).match(pattern);
        if (match && match[1]) {
            console.log('Found subscription name:', match[1].trim());
            return match[1].trim();
        }
    }

    // If no pattern matches, try to extract from subject
    const subjectWords = subject.split(/[\s\-_]+/);
    if (subjectWords.length > 0) {
        // Filter out common words that shouldn't be subscription names
        const filteredWords = subjectWords.filter(word => 
            !['confirm', 'verification', 'welcome', 'payment', 'receipt', 'subscription', 'please'].includes(word.toLowerCase())
        );
        if (filteredWords.length > 0) {
            console.log('Extracted name from subject:', filteredWords[0].trim());
            return filteredWords[0].trim();
        }
    }

    console.log('No subscription name found');
    return null;
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

function detectSubscriptionEmail(subject, snippet) {
    const lowerSubject = subject.toLowerCase();
    const lowerSnippet = snippet.toLowerCase();

    // First check using the simpler isSubscriptionEmail function
    if (isSubscriptionEmail(subject, snippet)) {
        const subscriptionName = extractSubscriptionName(subject, snippet);
        return {
            isSubscription: true,
            subscriptionName: subscriptionName
        };
    }

    // If that doesn't match, try the patterns
    const subscriptionPatterns = [
        /subscription (?:confirmed|activated|started|renewed)/i,
        /your (?:subscription|membership) (?:has been|is) (?:confirmed|activated|started|renewed)/i,
        /welcome to (?:your|the) (?:subscription|membership)/i,
        /(?:subscription|membership) (?:payment|billing) (?:confirmed|received|processed)/i,
        /(?:monthly|annual|yearly) (?:subscription|membership) (?:confirmed|activated)/i,
        /(?:premium|pro|basic) (?:subscription|membership) (?:confirmed|activated)/i,
        /(?:trial|free trial) (?:subscription|membership) (?:started|activated)/i,
        /(?:recurring|automatic) (?:payment|billing) (?:confirmed|set up)/i,
        /(?:payment|billing) (?:for|of) (?:subscription|membership) (?:confirmed|received)/i,
        /(?:subscription|membership) (?:plan|package) (?:confirmed|activated)/i,
        /premium (?:access|account|membership|subscription) (?:activated|confirmed|started)/i,
        /your premium (?:access|account|membership|subscription) (?:has been|is now) (?:activated|confirmed|started)/i,
        /welcome to (?:your|the) premium (?:access|account|membership|subscription)/i,
        /premium (?:features|benefits) (?:activated|confirmed|started)/i,
        /upgraded to premium/i,
        /premium upgrade (?:confirmed|activated|started)/i,
        /premium (?:plan|package) (?:confirmed|activated|started)/i
    ];

    // Check if any subscription pattern matches
    const isSubscription = subscriptionPatterns.some(pattern => 
        pattern.test(lowerSubject) || pattern.test(lowerSnippet)
    );

    if (isSubscription) {
        // Extract subscription name from subject
        let subscriptionName = extractSubscriptionName(subject, snippet);
        
        if (subscriptionName) {
            return {
                isSubscription: true,
                subscriptionName: subscriptionName
            };
        }
    }

    // If no specific patterns match but the email contains subscription-related words,
    // still suggest it as a potential subscription
    const subscriptionWords = ['subscription', 'membership', 'premium', 'trial', 'payment', 'billing'];
    const hasSubscriptionWord = subscriptionWords.some(word => 
        lowerSubject.includes(word) || lowerSnippet.includes(word)
    );

    if (hasSubscriptionWord) {
        return {
            isSubscription: true,
            subscriptionName: extractSubscriptionName(subject, snippet) || subject.split(/[\s\-_]+/)[0]
        };
    }

    return {
        isSubscription: false,
        subscriptionName: null
    };
}

// Main function to fetch and analyze emails
export async function fetchEmails(accessToken) {
    try {
        console.log('Fetching emails...');
        const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=10", {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
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
            return [];
        }

        const emails = [];
        for (const message of data.messages) {
            try {
                const emailData = await fetchEmailContent(accessToken, message.id);
                const headers = emailData.payload.headers;
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                const snippet = emailData.snippet || '';
                const sender = getSenderEmail(headers);

                // Check if it's a subscription email
                const { isSubscription, subscriptionName } = detectSubscriptionEmail(subject, snippet);
                
                if (isSubscription) {
                    emails.push({
                        id: message.id,
                        sender,
                        subject,
                        snippet,
                        subscriptionName: subscriptionName || sender.split('@')[0]
                    });
                }
            } catch (error) {
                console.error('Error processing email:', error);
                continue;
            }
        }

        console.log('Found subscription emails:', emails.length);
        return emails;
    } catch (error) {
        console.error('Error fetching emails:', error);
        throw error;
    }
}

// Function to mark email as read
export async function markEmailAsRead(accessToken, messageId) {
    try {
        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                removeLabelIds: ['UNREAD']
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error marking email as read:', error);
        throw error;
    }
}
