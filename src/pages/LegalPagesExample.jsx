import React, { useState } from 'react';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';

/**
 * Legal Pages Example Component
 * This demonstrates how to integrate Terms of Service and Privacy Policy pages into your app
 */
export default function LegalPagesExample() {
  const [currentPage, setCurrentPage] = useState(null);

  const handleClose = () => setCurrentPage(null);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Legal Documentation</h2>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setCurrentPage('tos')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          View Terms of Service
        </button>
        <button
          onClick={() => setCurrentPage('privacy')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          View Privacy Policy
        </button>
      </div>

      {/* Modal overlay for legal pages */}
      {currentPage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85vh',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {currentPage === 'tos' && <TermsOfService onClose={handleClose} />}
            {currentPage === 'privacy' && <PrivacyPolicy onClose={handleClose} />}
          </div>
        </div>
      )}
    </div>
  );
}
