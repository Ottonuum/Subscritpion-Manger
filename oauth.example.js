// OAuth configuration
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // Replace with your Google Client ID
const REDIRECT_URI = chrome.identity.getRedirectURL();
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

import { fetchEmails } from "./fetchemails.js";

// Initialize OAuth
export async function initializeAuth() {
    try {
        const { gmailAccessToken } = await chrome.storage.local.get('gmailAccessToken');
        if (gmailAccessToken) {
            // Verify token is still valid
            const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
                headers: {
                    Authorization: `Bearer ${gmailAccessToken}`
                }
            });
            
            if (response.ok) {
                return true;
            } else {
                // Token is invalid, remove it
                await chrome.storage.local.remove('gmailAccessToken');
                return false;
            }
        }
        return false;
    } catch (error) {
        console.error('Error initializing auth:', error);
        return false;
    }
}

// Check authentication status
export async function checkAuthStatus() {
    try {
        const { gmailAccessToken } = await chrome.storage.local.get('gmailAccessToken');
        return !!gmailAccessToken;
    } catch (error) {
        console.error('Error checking auth status:', error);
        return false;
    }
}

// Start OAuth flow
export async function startOAuth() {
    try {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
            `?client_id=${encodeURIComponent(CLIENT_ID)}` +
            `&response_type=token` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
            `&prompt=select_account`;

        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: authUrl,
                    interactive: true
                },
                async (redirectUrl) => {
                    if (chrome.runtime.lastError) {
                        console.error('OAuth error:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (!redirectUrl) {
                        reject(new Error('No redirect URL received'));
                        return;
                    }

                    // Parse the access token from the URL fragment
                    const m = redirectUrl.match(/[#&]access_token=([^&]+)/);
                    if (!m) {
                        reject(new Error('No access token found in redirect URL'));
                        return;
                    }

                    const token = m[1];
                    try {
                        await chrome.storage.local.set({ gmailAccessToken: token });
                        resolve(token);
                    } catch (error) {
                        console.error('Error storing token:', error);
                        reject(error);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error in OAuth flow:', error);
        throw error;
    }
}

// Revoke OAuth token
export async function revokeAuth() {
    try {
        const { gmailAccessToken } = await chrome.storage.local.get('gmailAccessToken');
        if (gmailAccessToken) {
            await chrome.identity.removeCachedAuthToken({ token: gmailAccessToken });
            await chrome.storage.local.remove('gmailAccessToken');
        }
    } catch (error) {
        console.error('Error revoking auth:', error);
        throw error;
    }
} 