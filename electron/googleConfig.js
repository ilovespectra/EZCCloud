const fs = require('fs');
const path = require('path');
const net = require('net');

const defaultGoogleOAuthConfig = {
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://127.0.0.1:3001/oauth/callback'
};

function parseEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  const values = {};
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) values[key] = value;
  }

  return values;
}

function getGoogleOAuthConfig(options = {}) {
  const envFilePath = options.envFilePath || path.resolve(__dirname, '..', '.env');
  const envValues = parseEnvFile(envFilePath);

  return normalizeGoogleOAuthConfig({
    clientId: process.env.EZCLOUD_API_KEY || process.env.OAUTHCLIENTID || process.env.GOOGLE_CLIENT_ID || envValues.EZCLOUD_API_KEY || envValues.OAUTHCLIENTID || envValues.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.EZCLOUD_API_SECRET || process.env.OAUTHSECRET || process.env.GOOGLE_CLIENT_SECRET || envValues.EZCLOUD_API_SECRET || envValues.OAUTHSECRET || envValues.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || envValues.GOOGLE_REDIRECT_URI || defaultGoogleOAuthConfig.redirectUri
  });
}

function normalizeGoogleOAuthConfig(config = {}) {
  return {
    clientId: String(config.clientId || '').trim(),
    clientSecret: String(config.clientSecret || '').trim(),
    redirectUri: String(config.redirectUri || defaultGoogleOAuthConfig.redirectUri).trim()
  };
}

function mergeGoogleOAuthConfig(currentConfig = {}, fallbackConfig = {}) {
  return normalizeGoogleOAuthConfig({
    clientId: currentConfig.clientId || fallbackConfig.clientId || '',
    clientSecret: currentConfig.clientSecret || fallbackConfig.clientSecret || '',
    redirectUri: currentConfig.redirectUri || fallbackConfig.redirectUri || defaultGoogleOAuthConfig.redirectUri
  });
}

function getAvailablePort(preferredPort = 3001, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    const tryPort = (attempt) => {
      const port = attempt === 0 ? preferredPort : preferredPort + attempt;
      const tester = net.createServer();

      tester.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempt < maxAttempts) {
          return tryPort(attempt + 1);
        }
        reject(error);
      });

      tester.once('listening', () => {
        tester.once('close', () => resolve(port));
        tester.close();
      });

      tester.listen(port, '127.0.0.1');
    };

    tryPort(0);
  });
}

module.exports = {
  getGoogleOAuthConfig,
  normalizeGoogleOAuthConfig,
  mergeGoogleOAuthConfig,
  getAvailablePort
};
