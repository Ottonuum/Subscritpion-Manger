# Subscription Manager Chrome Extension

A Chrome extension to help you track and manage your subscriptions.

## Setup

1. Clone the repository
2. Rename `oauth.example.js` to `oauth.js`
3. Replace `YOUR_CLIENT_ID_HERE` in `oauth.js` with your Google Client ID
4. Get your Google Client ID:
   - Go to the [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one
   - Enable the Gmail API
   - Go to Credentials
   - Create an OAuth 2.0 Client ID
   - Add the client ID to your `oauth.js` file

## Development

1. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Features

- Track subscription end dates
- Get notifications for expiring subscriptions
- Auto-detect subscription emails
- Manual subscription management

## Security

This extension uses OAuth 2.0 for secure authentication with Gmail. Your credentials are stored locally and are never sent to any external servers.

## Project Structure

- `oauth.example.js` - Template file with placeholder values (safe to share)
- `oauth.js` - Your actual OAuth configuration (keep private)
- Other files are safe to share as they don't contain sensitive information

## License

MIT License 