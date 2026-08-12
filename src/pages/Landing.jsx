import { useState } from 'react';
import '../styles.css';

export default function Landing({ onSignIn }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);

  const features = [
    {
      title: 'Easy File Transfer',
      description: 'Transfer files between Google Drive and your local storage with a few clicks'
    },
    {
      title: 'Bulk Operations',
      description: 'Select and manage multiple files at once for efficient batch processing'
    },
    {
      title: 'Auto-Delete Option',
      description: 'Optionally delete files from Google Drive after successfully importing them'
    },
    {
      title: 'Secure Authentication',
      description: 'Industry-standard OAuth 2.0 authentication with Google'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Header */}
      <header style={{
        padding: '20px 40px',
        background: 'rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold' }}>EZC-Cloud Transfer</h1>
        <nav style={{ display: 'flex', gap: '20px' }}>
          <a href="/privacy-policy.html" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', fontSize: '14px' }}>Privacy Policy</a>
          <a href="/terms-of-service.html" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', fontSize: '14px' }}>Terms of Service</a>
        </nav>
      </header>

      {/* Main Content */}
      <main style={{ padding: '60px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '20px',
            lineHeight: '1.2'
          }}>
            Seamlessly Transfer Your Files
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '20px',
            marginBottom: '40px',
            maxWidth: '600px',
            margin: '0 auto 40px'
          }}>
            EZC-Cloud Transfer makes it easy to import files from Google Drive to your local storage. 
            Manage your files efficiently with our intuitive interface and powerful features.
          </p>
          <button
            onClick={onSignIn}
            style={{
              padding: '16px 48px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            Get Started - Sign In with Google
          </button>
        </div>

        {/* Features Section */}
        <div style={{ marginBottom: '80px' }}>
          <h3 style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '50px',
            textAlign: 'center'
          }}>
            Why Choose EZC-Cloud Transfer?
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '30px'
          }}>
            {features.map((feature, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredFeature(idx)}
                onMouseLeave={() => setHoveredFeature(null)}
                style={{
                  background: hoveredFeature === idx ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                  padding: '30px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  transform: hoveredFeature === idx ? 'translateY(-5px)' : 'translateY(0)'
                }}
              >
                <h4 style={{
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  marginBottom: '12px'
                }}>
                  {feature.title}
                </h4>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '16px',
                  lineHeight: '1.6'
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '50px', borderRadius: '12px', marginBottom: '80px' }}>
          <h3 style={{
            color: 'white',
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '30px',
            textAlign: 'center'
          }}>
            How It Works
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            textAlign: 'center'
          }}>
            {['Sign In', 'Browse Files', 'Select & Import', 'Manage & Delete'].map((step, idx) => (
              <div key={idx}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  background: 'white',
                  color: '#667eea',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '20px',
                  margin: '0 auto 15px'
                }}>
                  {idx + 1}
                </div>
                <p style={{ color: 'white', fontSize: '16px', fontWeight: '500' }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '30px 40px',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '14px'
      }}>
        <p>EZC-Cloud Transfer © 2024. All rights reserved.</p>
        <p style={{ marginTop: '10px', fontSize: '12px' }}>
          <a href="/privacy-policy.html" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', marginRight: '20px' }}>Privacy Policy</a>
          <a href="/terms-of-service.html" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none' }}>Terms of Service</a>
        </p>
      </footer>
    </div>
  );
}
