<h1 align="center">
TMS and Meroshare Helper
</h1>
<p align="center"> Extension for chromium based browsers to solve and autofill captchas on NEPSE TMS sites. </p>
<h2 align="center">
Demo
</h2>
<p align="center"><img src="https://user-images.githubusercontent.com/46302068/215273678-4ba5f4fc-01b5-4ab6-bad9-429388e4d366.gif" width="400"/></p>

# TMS Captcha Solver

> Browser extension to solve captchas and auto-fill credentials for NEPSE TMS and Meroshare sites.

## Features

### Account Management

- Add/Edit/Delete TMS and Meroshare accounts
- Set primary accounts for each broker in TMS
- Set single primary account for Meroshare
- Backup/Restore account configurations
- Toggle analytics tracking

### TMS Auto-Login

- Automatically solves captcha on TMS login page
- Auto-fills credentials for matching broker
- Supports multiple brokers with primary account per broker
- Handles failed captcha attempts with reload
- Analytics tracking for successful logins

### Meroshare Auto-Login

- Auto-fills credentials on Meroshare login page
- Handles Select2 dropdown for DP selection
- Angular form integration
- Single primary account system
- Analytics tracking for successful logins

### Configuration

- Account storage in browser local storage
- Analytics opt-in/opt-out
- Account backup/restore functionality
- Tab switching between TMS/Meroshare accounts

### UI Features

- Clean account management interface
- Primary account indicators
- Broker/DP number badges
- Success/Error notifications
- Empty state handling

## Installation

1. Download `TMSCaptcha_v*.zip` from releases
2. Enable developer mode in chrome://extensions/
3. Drag and drop zip file to install

## Building
```bash
# Install dependencies
yarn install

# Build extension
yarn build
