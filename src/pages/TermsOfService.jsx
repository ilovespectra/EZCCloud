import React from 'react';

export default function TermsOfService({ onClose }) {
  return (
    <div className="legal-page-container">
      <div className="legal-page-header">
        <h1>Terms of Service</h1>
        {onClose && <button onClick={onClose} className="close-btn">×</button>}
      </div>
      
      <div className="legal-page-content">
        <p className="last-updated">Last Updated: January 2025</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using EZC-Cloud Transfer ("the Service"), you accept and agree to be bound by 
            the terms and provision of this agreement. If you do not agree to abide by the above, 
            please do not use this service.
          </p>
        </section>

        <section>
          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily download one copy of the materials (information or software) 
            on EZC-Cloud Transfer for personal, non-commercial transitory viewing only. This is the grant of 
            a license, not a transfer of title, and under this license you may not:
          </p>
          <ul>
            <li>Modifying or copying the materials</li>
            <li>Using the materials for any commercial purpose or for any public display</li>
            <li>Attempting to decompile or reverse engineer any software contained on the Service</li>
            <li>Removing any copyright or other proprietary notations from the materials</li>
            <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
          </ul>
        </section>

        <section>
          <h2>3. Disclaimer</h2>
          <p>
            The materials on EZC-Cloud Transfer are provided on an 'as is' basis. EZC-Cloud makes no warranties, 
            expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, 
            implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement 
            of intellectual property or other violation of rights.
          </p>
        </section>

        <section>
          <h2>4. Limitations</h2>
          <p>
            In no event shall EZC-Cloud or its suppliers be liable for any damages (including, without limitation, 
            damages for loss of data or profit, or due to business interruption) arising out of the use or 
            inability to use the materials on EZC-Cloud Transfer, even if EZC-Cloud or an authorized representative 
            has been notified orally or in writing of the possibility of such damage.
          </p>
        </section>

        <section>
          <h2>5. Accuracy of Materials</h2>
          <p>
            The materials appearing on EZC-Cloud Transfer could include technical, typographical, or photographic errors. 
            EZC-Cloud does not warrant that any of the materials on the Service are accurate, complete, or current. 
            EZC-Cloud may make changes to the materials contained on the Service at any time without notice.
          </p>
        </section>

        <section>
          <h2>6. Links</h2>
          <p>
            EZC-Cloud has not reviewed all of the sites linked to its website and is not responsible for the contents 
            of any such linked site. The inclusion of any link does not imply endorsement by EZC-Cloud of the site. 
            Use of any such linked website is at the user's own risk.
          </p>
        </section>

        <section>
          <h2>7. Modifications</h2>
          <p>
            EZC-Cloud may revise these terms of service for the Service at any time without notice. 
            By using the Service, you are agreeing to be bound by the then current version of these terms of service.
          </p>
        </section>

        <section>
          <h2>8. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in accordance with the laws of the United States, 
            and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>

        <section>
          <h2>9. Contact Information</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at support@ezc-cloud.example
          </p>
        </section>
      </div>
    </div>
  );
}
