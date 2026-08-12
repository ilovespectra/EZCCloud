# Legal Pages Setup Guide

This directory contains Terms of Service and Privacy Policy pages for your EZC-Cloud Transfer application.

## Files Included

### React Components (for Electron app integration)
- `src/pages/TermsOfService.jsx` - Terms of Service component
- `src/pages/PrivacyPolicy.jsx` - Privacy Policy component
- `src/pages/LegalPagesExample.jsx` - Example integration component
- `src/styles-legal.css` - CSS styling for legal pages

### Standalone HTML Files
- `legal/terms-of-service.html` - Standalone Terms of Service page
- `legal/privacy-policy.html` - Standalone Privacy Policy page

## Usage

### Option 1: React Components (Recommended for Electron App)

Import and use in your App.jsx:

```jsx
import { useState } from 'react';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import './styles-legal.css';

function App() {
  const [showTOS, setShowTOS] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div>
      {/* Your main app content */}
      <button onClick={() => setShowTOS(true)}>Terms of Service</button>
      <button onClick={() => setShowPrivacy(true)}>Privacy Policy</button>

      {/* Modal for Terms of Service */}
      {showTOS && (
        <div className="legal-page-modal-overlay">
          <TermsOfService onClose={() => setShowTOS(false)} />
        </div>
      )}

      {/* Modal for Privacy Policy */}
      {showPrivacy && (
        <div className="legal-page-modal-overlay">
          <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
        </div>
      )}
    </div>
  );
}
```

### Option 2: Standalone HTML Pages

These can be viewed directly in a browser or opened in Electron:

```javascript
// In your Electron main process (electron/main.js)
const { BrowserWindow } = require('electron');

// Open Terms of Service in new window
const tosWindow = new BrowserWindow();
tosWindow.loadFile('./legal/terms-of-service.html');

// Open Privacy Policy in new window
const ppWindow = new BrowserWindow();
ppWindow.loadFile('./legal/privacy-policy.html');
```

Or create external links:

```jsx
<a href="#" onClick={() => window.open('./legal/terms-of-service.html')}>
  Terms of Service
</a>
```

## Customization

### Change Contact Information
Edit the following sections in both components and HTML files:
- Section 9 in TermsOfService.jsx / terms-of-service.html
- Section 9 in PrivacyPolicy.jsx / privacy-policy.html

Replace `support@ezc-cloud.example` and `privacy@ezc-cloud.example` with your actual contact information.

### Update Last Modified Date
Change the "Last Updated" dates in all files to reflect when your policies were last updated.

### Add Company Details
Update company name, address, and contact details throughout the documents.

## Best Practices

1. **Keep Policies Updated**: Review and update these policies regularly, especially if your data practices change.
2. **Legal Review**: Have an attorney review these policies to ensure they comply with applicable laws.
3. **Make Accessible**: Ensure these policies are easily accessible from your app (footer links, settings, etc.).
4. **User Acknowledgment**: Consider requiring users to acknowledge these policies during sign-up or first launch.
5. **Version History**: Keep track of policy versions and notify users of significant changes.

## Legal Notice

These are template documents. You should:
- Customize them to accurately reflect your app's practices
- Have them reviewed by a qualified attorney
- Ensure compliance with:
  - GDPR (EU)
  - CCPA (California)
  - Other applicable privacy laws in your jurisdiction
