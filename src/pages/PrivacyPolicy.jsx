import React from 'react';

export default function PrivacyPolicy({ onClose }) {
  return (
    <div className="legal-page-container">
      <div className="legal-page-header">
        <h1>Privacy Policy</h1>
        {onClose && <button onClick={onClose} className="close-btn">×</button>}
      </div>
      
      <div className="legal-page-content">
        <p className="last-updated">Last Updated: January 2025</p>

        <section>
          <h2>1. Introduction</h2>
          <p>
            EZC-Cloud Transfer ("we", "us", "our", or "the Service") is committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
            use our application.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>We may collect information about you in a variety of ways. The information we may collect on the Site includes:</p>
          
          <h3>Personal Data</h3>
          <ul>
            <li>Email address (when you sign in with Google)</li>
            <li>Google Drive file metadata (names, sizes, dates)</li>
            <li>Usage statistics and activity logs</li>
          </ul>

          <h3>Automatic Data Collection</h3>
          <ul>
            <li>Device information (OS, application version)</li>
            <li>Log data (timestamps, file transfer records)</li>
            <li>Performance metrics</li>
          </ul>
        </section>

        <section>
          <h2>3. Use of Information</h2>
          <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. 
          Specifically, we may use information collected about you via the Service to:</p>
          <ul>
            <li>Authenticate you and maintain your account</li>
            <li>Process your file transfer requests</li>
            <li>Generate analytics and improve our Service</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your inquiries and customer service requests</li>
          </ul>
        </section>

        <section>
          <h2>4. Disclosure of Information</h2>
          <p>
            We do not sell, trade, or rent your personal identification information to others. 
            We may share generic aggregated demographic information not linked to any personal identification 
            information regarding visitors and users with our business partners and sponsors for the purposes 
            outlined above.
          </p>

          <h3>Third-Party Services</h3>
          <p>
            We use Google APIs to access your Google Drive data. Your use of Google services is governed by 
            Google's Privacy Policy. We do not have access to your Google password and only request the minimum 
            permissions necessary to transfer files.
          </p>
        </section>

        <section>
          <h2>5. Security of Information</h2>
          <p>
            We implement a variety of security measures to maintain the safety of your personal information entered, 
            submitted, or displayed on the Service. However, the Internet is not 100% secure, and we cannot guarantee 
            absolute security.
          </p>
        </section>

        <section>
          <h2>6. User Rights</h2>
          <p>
            Depending on your location, you may have the following rights regarding your personal data:
          </p>
          <ul>
            <li>The right to access your personal data</li>
            <li>The right to request deletion of your personal data</li>
            <li>The right to object to processing of your personal data</li>
            <li>The right to request restriction of processing</li>
          </ul>
        </section>

        <section>
          <h2>7. Children's Privacy</h2>
          <p>
            The Service is not designed for or intentionally targeted at children under 13 years of age. 
            We do not knowingly collect personal information from children under 13. If we discover that 
            a child under 13 has provided us with personal information, we will delete such information 
            immediately.
          </p>
        </section>

        <section>
          <h2>8. Changes to This Privacy Policy</h2>
          <p>
            EZC-Cloud reserves the right to modify this privacy policy at any time. Changes and clarifications 
            will take effect immediately upon their posting on the Service. If we make material changes to this 
            policy, we will notify you here that it has been updated.
          </p>
        </section>

        <section>
          <h2>9. Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please contact us at:
          </p>
          <p>
            Email: privacy@ezc-cloud.example<br/>
            Address: EZC-Cloud, Inc.<br/>
            United States
          </p>
        </section>
      </div>
    </div>
  );
}
