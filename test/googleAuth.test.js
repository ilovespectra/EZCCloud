const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { buildGoogleAuthUrl } = require('../electron/googleAuth');
const { getAvailablePort } = require('../electron/googleConfig');

test('buildGoogleAuthUrl uses the standard OAuth authorization-code flow', () => {
  const oauth = {
    generateAuthUrl(params) {
      return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(params).toString();
    }
  };

  const url = buildGoogleAuthUrl(oauth, {
    clientId: 'demo-client-id',
    redirectUri: 'http://127.0.0.1:3001/oauth/callback',
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file']
  });

  const parsed = new URL(url);
  assert.equal(parsed.host, 'accounts.google.com');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('access_type'), 'offline');
  assert.equal(parsed.searchParams.get('prompt'), 'consent');
  assert.equal(parsed.searchParams.get('client_id'), 'demo-client-id');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://127.0.0.1:3001/oauth/callback');
  assert.match(parsed.searchParams.get('scope'), /drive\.file/);
});

test('getAvailablePort skips a busy local port and returns a free callback port', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const busyPort = server.address().port;

  const nextPort = await getAvailablePort(busyPort, 3);

  assert.notEqual(nextPort, busyPort);
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});
