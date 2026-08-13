function buildGoogleAuthUrl(oauth, { clientId, redirectUri, scopes }) {
  return oauth.generateAuthUrl({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes.join(' ')
  });
}

module.exports = {
  buildGoogleAuthUrl
};
