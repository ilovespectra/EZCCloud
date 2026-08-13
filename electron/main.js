const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { google } = require('googleapis');
const { buildGoogleAuthUrl } = require('./googleAuth');
const { getGoogleOAuthConfig, normalizeGoogleOAuthConfig, mergeGoogleOAuthConfig, getAvailablePort } = require('./googleConfig');

let mainWindow;
let authClient;
let cachedToken = null;
let cachedFiles = [];
let cachedDestination = '';
let cachedGoogleConfig = getGoogleOAuthConfig();
let callbackServer = null;
let authWindow = null;
let callbackPort = Number(process.env.GOOGLE_REDIRECT_PORT || 3001);

// Helper to extract serializable token properties
function getSerializableToken(token) {
  if (!token) return null;
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    token_type: token.token_type,
    expiry_date: token.expiry_date,
    id_token: token.id_token
  };
}

// Helper to check if token has required scopes
function hasRequiredScopes(token, requiredScopes) {
  if (!token || !token.scope) return false;
  const grantedScopes = token.scope.split(' ');
  return requiredScopes.every(scope => grantedScopes.includes(scope));
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    const port = process.env.PORT || '3000';
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }
}

app.whenReady().then(() => {
  console.log('[Main] App ready, creating window...');
  try {
    createWindow();
    console.log('[Main] Window created successfully');
  } catch (error) {
    console.error('[Main] Failed to create window:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  console.error('[Main] Failed during app ready:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function buildAuthClient() {
  if (authClient) {
    console.log('[OAuth] Returning cached auth client');
    return authClient;
  }

  const { clientId, clientSecret, redirectUri } = cachedGoogleConfig;
  console.log('[OAuth] Building new OAuth client with redirectUri:', redirectUri);
  
  // Validate credentials exist
  if (!clientId || clientId.trim() === '') {
    throw new Error('Google OAuth client ID is not configured. Please set GOOGLE_CLIENT_ID in your .env file.');
  }
  if (!redirectUri || redirectUri.trim() === '') {
    throw new Error('Google OAuth redirect URI is not configured.');
  }
  
  try {
    console.log('[OAuth] Creating OAuth2 instance with clientId:', clientId.substring(0, 20) + '...');
    // Use setImmediate to avoid blocking the main thread
    authClient = new google.auth.OAuth2(clientId, clientSecret || '', redirectUri);
    console.log('[OAuth] OAuth client created successfully');
  } catch (error) {
    console.error('[OAuth] Failed to create OAuth2 client:', error);
    authClient = null; // Reset on failure
    throw new Error(`Failed to initialize Google OAuth client: ${error.message}`);
  }
  return authClient;
}

function refreshGoogleConfig() {
  const fallbackConfig = getGoogleOAuthConfig();
  cachedGoogleConfig = mergeGoogleOAuthConfig(cachedGoogleConfig, fallbackConfig);
  authClient = null;
  return cachedGoogleConfig;
}

function getUserDataDir() {
  return path.join(os.homedir(), '.ezccloud-transfer');
}

function ensureStorage() {
  const dir = getUserDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveSession() {
  const dir = ensureStorage();
  const data = {
    token: cachedToken,
    destination: cachedDestination,
    files: cachedFiles,
    googleConfig: cachedGoogleConfig
  };
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify(data));
}

function loadSession() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(getUserDataDir(), 'session.json'), 'utf8'));
    cachedToken = data.token || null;
    cachedDestination = data.destination || '';
    cachedFiles = data.files || [];
    cachedGoogleConfig = mergeGoogleOAuthConfig(data.googleConfig || {}, getGoogleOAuthConfig());
    return data;
  } catch {
    return {};
  }
}

async function startCallbackServer() {
  if (callbackServer) {
    console.log('[Server] Callback server already running on port', callbackPort);
    return callbackServer;
  }

  try {
    console.log('[Server] Starting callback server...');
    callbackPort = await getAvailablePort(Number(process.env.GOOGLE_REDIRECT_PORT || 3001), 20);
    console.log('[Server] Available port found:', callbackPort);
    
    if (cachedGoogleConfig.redirectUri && cachedGoogleConfig.redirectUri.includes('localhost')) {
      cachedGoogleConfig.redirectUri = `http://127.0.0.1:${callbackPort}/oauth/callback`;
    } else if (!cachedGoogleConfig.redirectUri || cachedGoogleConfig.redirectUri.includes('3001')) {
      cachedGoogleConfig.redirectUri = `http://127.0.0.1:${callbackPort}/oauth/callback`;
    }

    callbackServer = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, `http://127.0.0.1:${callbackPort}`);

      if (requestUrl.pathname === '/oauth/callback') {
        const code = requestUrl.searchParams.get('code');
        const error = requestUrl.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Authorization complete. You can close this window and return to EZCCloud Transfer.');

        if (error) {
          console.error('[Server] OAuth error:', error);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('status', `Google sign-in was cancelled: ${error}`);
          }
          return;
        }

        if (code) {
          console.log('[Server] Auth code received, processing...');
          handleAuthCode(code).catch((err) => {
            console.error('[Server] Error in handleAuthCode:', err);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('status', `Google sign-in failed: ${err.message}`);
            }
          });
        }
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    });

    callbackServer.listen(callbackPort, '127.0.0.1');
    console.log('[Server] Callback server listening on port', callbackPort);
    return callbackServer;
  } catch (error) {
    console.error('[Server] Failed to start callback server:', error);
    throw error;
  }
}

function closeAuthWindow() {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }
  authWindow = null;
}

function openAuthWindow(authUrl) {
  console.log('[Auth] Opening Google OAuth in system browser');
  console.log('[Auth] Auth URL:', authUrl.substring(0, 80) + '...');
  
  const redirectUri = cachedGoogleConfig.redirectUri || `http://127.0.0.1:${callbackPort}/oauth/callback`;
  console.log('[Auth] Redirect URI:', redirectUri);
  
  // Show message to user
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status', 'Opening Google sign-in in your browser. Please complete the sign-in process and you will be redirected back to EZCCloud.');
  }
  
  // Open the OAuth URL in the system's default browser
  shell.openExternal(authUrl).catch((err) => {
    console.error('[Auth] Failed to open URL in browser:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status', `Failed to open Google sign-in: ${err.message}`);
    }
  });
}

async function handleAuthCode(code) {
  console.log('[Auth] Handling auth code...');
  try {
    const oauth = buildAuthClient();
    console.log('[Auth] OAuth client built successfully');
    
    console.log('[Auth] Calling oauth.getToken...');
    const { tokens } = await oauth.getToken(code);
    console.log('[Auth] Token received:', tokens ? 'valid token object' : 'empty');
    
    oauth.setCredentials(tokens);
    cachedToken = tokens;
    saveSession();
    console.log('[Auth] Session saved');

    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Auth] Sending token to renderer...');
      mainWindow.webContents.send('token', getSerializableToken(tokens));
      console.log('[Auth] Sending success status...');
      mainWindow.webContents.send('status', 'Signed in successfully. Loading files...');
    } else {
      console.error('[Auth] Main window not available or destroyed');
    }

    return tokens;
  } catch (error) {
    console.error('[Auth] Error handling auth code:', error);
    throw error;
  }
}

ipcMain.handle('start-auth', async () => {
  try {
    console.log('[IPC] start-auth called');
    
    // Add a small delay to ensure Electron is fully initialized
    await new Promise(resolve => setTimeout(resolve, 100));
    
    refreshGoogleConfig();
    console.log('[IPC] Config refreshed');
    
    const oauth = buildAuthClient();
    console.log('[IPC] Auth client built');
    
    const { clientId, redirectUri } = cachedGoogleConfig;

    if (!clientId) {
      const message = 'Enter your Google OAuth client ID first.';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status', message);
      }
      return message;
    }

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/photoslibrary'
    ];
    console.log('[IPC] Building auth URL with:');
    console.log('[IPC]   clientId:', clientId.substring(0, 20) + '...');
    console.log('[IPC]   redirectUri:', redirectUri);
    console.log('[IPC]   scopes:', scopes.length);
    
    const authUrl = buildGoogleAuthUrl(oauth, {
      clientId,
      redirectUri,
      scopes
    });
    console.log('[IPC] Auth URL generated:', authUrl.substring(0, 150) + '...');

    console.log('[IPC] Starting callback server...');
    await startCallbackServer();
    console.log('[IPC] Callback server started');
    
    console.log('[IPC] Opening auth window...');
    openAuthWindow(authUrl);
    console.log('[IPC] Auth window opened');

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth-url', authUrl);
      mainWindow.webContents.send('status', 'Opening Google sign-in in the popup window…');
    }

    return authUrl;
  } catch (error) {
    const errorMessage = `Authentication failed: ${error.message}`;
    console.error('[IPC] start-auth error:', errorMessage, error.stack);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status', errorMessage);
    }
    return { error: errorMessage };
  }
});

ipcMain.handle('get-initial-state', async () => {
  const session = loadSession();
  return {
    token: session.token || null,
    destination: session.destination || '',
    files: session.files || [],
    googleConfig: cachedGoogleConfig
  };
});

ipcMain.handle('save-google-config', async (_event, config) => {
  cachedGoogleConfig = mergeGoogleOAuthConfig(config || {}, getGoogleOAuthConfig());
  authClient = null;
  saveSession();
  return cachedGoogleConfig;
});

ipcMain.handle('list-files', async (_event, payload) => {
  console.log('[ListFiles] Starting...');
  try {
    // Handle both old format (just token) and new format (object with token)
    const token = payload.token || payload;
    
    const oauth = buildAuthClient();
    console.log('[ListFiles] OAuth client ready');
    
    oauth.setCredentials(token);
    console.log('[ListFiles] Credentials set');
    
    const drive = google.drive({ version: 'v3', auth: oauth });
    console.log('[ListFiles] Drive API ready');
    
    // Recursive function to fetch all files and folders including nested ones
    async function fetchAllItemsRecursively(parentId = null, depth = 0) {
      const indent = '  '.repeat(depth);
      let allItems = [];
      let pageToken = null;

      do {
        // Use 'root' for root-level files, or the specific parentId for folder contents
        const query = `'${parentId || 'root'}' in parents and trashed = false`;

        const res = await drive.files.list({
          pageSize: 1000,
          pageToken: pageToken,
          q: query,
          fields: 'files(id,name,mimeType,thumbnailLink,iconLink,webViewLink,size,modifiedTime),nextPageToken',
          orderBy: 'name_natural'
        });

        const items = (res.data.files || []);
        const parentLabel = parentId ? `(parent: ${parentId})` : '(root)';
        // Reduced logging - only log at root level
        if (depth === 0) {
          console.log(`${indent}[ListFiles] Fetched ${items.length} items ${parentLabel}`);
        }
        
        for (const item of items) {
          const itemWithMeta = {
            ...item,
            thumbnail: item.thumbnailLink || item.iconLink || '',
            parentPath: parentId || null
          };
          
          allItems.push(itemWithMeta);
          // Comment out verbose per-file logging
          // console.log(`${indent}  - Added: ${item.name} (id: ${item.id}, parentPath: ${itemWithMeta.parentPath}, isFolder: ${item.mimeType === 'application/vnd.google-apps.folder'})`);
          
          // If it's a folder, recursively fetch its contents
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            // Reduced logging for folder recursion
            try {
              const nestedItems = await fetchAllItemsRecursively(item.id, depth + 1);
              // Comment out nested folder logging
              // console.log(`${indent}[ListFiles] Folder "${item.name}" has ${nestedItems.length} nested items`);
              allItems = [...allItems, ...nestedItems];
            } catch (err) {
              console.error(`${indent}[ListFiles] Error fetching contents of folder "${item.name}":`, err.message);
            }
          }
        }
        
        pageToken = res.data.nextPageToken || null;
      } while (pageToken);

      return allItems;
    }

    // Fetch all files and folders recursively
    const allItems = await fetchAllItemsRecursively();

    // Sort folders first, then files
    allItems.sort((a, b) => {
      const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
      const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
      
      if (aIsFolder === bIsFolder) {
        return a.name.localeCompare(b.name);
      }
      return aIsFolder ? -1 : 1;
    });

    cachedFiles = allItems;
    saveSession();
    
    console.log('[ListFiles] Returning all', allItems.length, 'files/folders');
    
    // Sanitize files to remove non-serializable properties for IPC
    const sanitizedFiles = allItems.map(file => ({
      id: String(file.id || ''),
      name: String(file.name || ''),
      mimeType: String(file.mimeType || ''),
      thumbnail: String(file.thumbnail || ''),
      parentPath: file.parentPath ? String(file.parentPath) : null,
      createdTime: file.createdTime ? String(file.createdTime) : null,
      modifiedTime: file.modifiedTime ? String(file.modifiedTime) : null,
      size: file.size ? String(file.size) : null,
      webViewLink: file.webViewLink ? String(file.webViewLink) : null
    }));
    
    return { 
      files: sanitizedFiles
    };
  } catch (error) {
    console.error('[ListFiles] Error:', error);
    throw error;
  }
});

ipcMain.handle('pick-destination', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return '';
  cachedDestination = result.filePaths[0];
  saveSession();
  return cachedDestination;
});

ipcMain.handle('import-files', async (_event, payload) => {
  const token = payload.token || cachedToken;
  if (!token) return { message: 'Please sign in first.' };

  const oauth = buildAuthClient();
  oauth.setCredentials(token);
  const drive = google.drive({ version: 'v3', auth: oauth });
  const destination = payload.destination || cachedDestination;
  if (!destination) return { message: 'Select a destination folder first.' };
  fs.mkdirSync(destination, { recursive: true });

  const results = [];
  let transferred = 0;
  // Only count actual files, not folders, in the total
  const totalFiles = payload.files ? payload.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length : 0;
  
  console.log(`[ImportFiles] Starting transfer of ${totalFiles} files to ${destination}`);
  console.log(`[ImportFiles] Total payload files (including folders): ${payload.files?.length || 0}`);

  // Lightweight duplicate detection: only inspect the exact target path for each file.
  // This avoids recursively hashing the entire destination tree (which can be very expensive).
  const filesToDownload = [];
  const filesToSkip = [];
  
  for (const file of (payload.files || [])) {
    if (file.mimeType === 'application/vnd.google-apps.folder') continue; // Skip folders

    let targetPath = destination;
    if (file.parentPath) {
      const parentFolder = (payload.files || []).find(f => f.id === file.parentPath);
      if (parentFolder && parentFolder.name) {
        targetPath = path.join(destination, parentFolder.name);
      }
    }

    const filePath = path.join(targetPath, file.name);
    if (fs.existsSync(filePath)) {
      filesToSkip.push({ name: file.name, reason: 'file with same name exists at destination' });
    } else {
      filesToDownload.push(file);
    }
  }
  
  console.log(`[ImportFiles] Summary: ${filesToSkip.length} duplicates, ${filesToDownload.length} to download`);
  
  if (filesToDownload.length === 0) {
    console.log('[ImportFiles] All files already exist. Skipping transfer.');
    return { 
      message: `All ${filesToSkip.length} files already exist at destination. Transfer skipped.`,
      results: filesToSkip.map(f => ({ name: f.name, status: 'duplicate', reason: f.reason }))
    };
  }
  
  // Use the actual count of files to download, not the initial count
  const actualFilesToDownload = filesToDownload.length;

  // Determine file format for export
  function getExportMimeType(mimeType) {
    const exportFormats = {
      'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.google-apps.drawing': 'image/png',
      'application/vnd.google-apps.script': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.google-apps.form': 'application/json',
      'application/vnd.google-apps.site': 'text/html',
      'application/vnd.google-apps.folder': null  // Folders don't export
    };
    return exportFormats[mimeType] || null;
  }

  function getFileExtension(mimeType, originalName) {
    const extensions = {
      'application/vnd.google-apps.document': '.docx',
      'application/vnd.google-apps.spreadsheet': '.xlsx',
      'application/vnd.google-apps.presentation': '.pptx',
      'application/vnd.google-apps.drawing': '.png',
      'application/vnd.google-apps.script': '.docx'
    };
    return extensions[mimeType] || '';
  }

  // Helper function to download file with retry
  async function downloadFileWithRetry(driveApi, file, targetPath, maxRetries = 3) {
    let lastError;
    const isGoogleWorkspaceFile = getExportMimeType(file.mimeType) !== null;
    const exportMimeType = getExportMimeType(file.mimeType);
    const DOWNLOAD_TIMEOUT = 60000; // 60 second timeout per attempt
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let response;
        let finalPath = targetPath;
        
        if (isGoogleWorkspaceFile) {
          // For Google Workspace files, use export API
          // Add extension to filename if it doesn't have one
          if (!path.extname(finalPath)) {
            finalPath = targetPath + getFileExtension(file.mimeType);
          }
          
          response = await driveApi.files.export(
            { fileId: file.id, mimeType: exportMimeType },
            { responseType: 'stream' }
          );
          targetPath = finalPath;
        } else {
          // For regular files, download directly
          response = await driveApi.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'stream' }
          );
        }
        
        // Check if response is an error (happens when API returns error)
        if (typeof response.data === 'string' || (response.data && response.data.error)) {
          let errorMsg = 'Unknown error';
          try {
            const errorData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            errorMsg = errorData.error?.message || response.data.toString();
          } catch (e) {
            errorMsg = response.data.toString();
          }
          throw new Error(`Download failed: ${errorMsg}`);
        }

        const writer = fs.createWriteStream(targetPath);
        
        // Wrap stream operation with timeout
        await Promise.race([
          new Promise((resolve, reject) => {
            let downloadedSize = 0;
            
            response.data.on('data', (chunk) => {
              downloadedSize += chunk.length;
            });
            
            response.data.on('error', (err) => {
              writer.destroy();
              reject(err);
            });
            
            writer.on('finish', () => {
              resolve();
            });
            
            writer.on('error', reject);
            
            response.data.pipe(writer);
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Download timeout')), DOWNLOAD_TIMEOUT)
          )
        ]);
        
        // Verify file was written correctly
        const stats = fs.statSync(targetPath);
        const actualSize = stats.size;
        
        // For Google Workspace files, we can't verify size, just check it's not empty
        if (isGoogleWorkspaceFile) {
          if (actualSize === 0) {
            fs.unlinkSync(targetPath);
            throw new Error('File exported with 0 bytes');
          }
        }
        
        // Success - file was written
        console.log(`[ImportFiles] Downloaded: ${file.name}`);
        return true;
      } catch (err) {
        lastError = err;
        const errorMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err).substring(0, 100));
        
        // Clean up partial file
        try {
          if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
          }
        } catch (e) {
          // ignore cleanup errors
        }
        
        if (attempt < maxRetries) {
          // Silently retry without logging every attempt
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    throw lastError;
  }

  // Now process only files that need to be downloaded
  for (let i = 0; i < filesToDownload.length; i++) {
    const file = filesToDownload[i];
    
    // Build the full folder structure path from parent hierarchy
    let targetPath = destination;
    if (file.parentPath) {
      // Find the parent folder to get its name for the directory structure
      const parentFolder = (payload.files || []).find(f => f.id === file.parentPath);
      if (parentFolder && parentFolder.name) {
        targetPath = path.join(destination, parentFolder.name);
      }
    }
    fs.mkdirSync(targetPath, { recursive: true });
    
    const filePath = path.join(targetPath, file.name);
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder' || file.mimeType?.includes('folder');

    if (isFolder) {
      try {
        fs.mkdirSync(filePath, { recursive: true });
        results.push({ name: file.name, status: 'folder created' });
      } catch (err) {
        console.error(`[ImportFiles] Error creating folder ${file.name}:`, err);
        results.push({ name: file.name, status: 'failed', error: err.message });
      }
      
      // Yield to prevent UI freezing
      await new Promise(resolve => setImmediate(resolve));
      continue;
    }

    // Download file with retry
    try {
      const dest = path.resolve(filePath);
      await downloadFileWithRetry(drive, file, dest);
      
      if (payload.mode === 'move' || payload.autoDelete) {
        try {
          await drive.files.delete({ fileId: file.id });
        } catch (err) {
          console.error(`[ImportFiles] Error deleting from Drive ${file.name}:`, err);
        }
      }

      transferred++;
      results.push({ name: file.name, status: 'downloaded successfully' });
      
      if (mainWindow) {
        mainWindow.webContents.send('import-progress', {
          transferred,
          total: actualFilesToDownload,
          current: file.name,
          status: 'downloaded'
        });
      }
    } catch (err) {
      console.error(`[ImportFiles] Failed to download ${file.name}:`, err.message);
      results.push({ name: file.name, status: 'failed', error: err.message });
      transferred++;
      
      if (mainWindow) {
        mainWindow.webContents.send('import-progress', {
          transferred,
          total: actualFilesToDownload,
          current: file.name,
          status: 'failed'
        });
      }
    }
    
    // Yield periodically to prevent UI freezing (every 5 files)
    if ((i + 1) % 5 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  return { 
    message: `Transferred ${results.filter(r => r.status.includes('successfully')).length} file(s). Results: ${results.length} total items processed.`, 
    results: results.map(r => ({
      name: String(r.name || ''),
      status: String(r.status || ''),
      error: r.error ? String(r.error) : undefined
    }))
  };
});

ipcMain.handle('delete-files', async (_event, payload) => {
  const token = payload.token || cachedToken;
  if (!token) return { message: 'Please sign in first.' };

  console.log('[DeleteFiles] Token structure:', {
    hasAccessToken: !!token.access_token,
    hasRefreshToken: !!token.refresh_token,
    tokenType: token.token_type,
    scope: token.scope ? token.scope.substring(0, 100) : 'N/A'
  });

  const oauth = buildAuthClient();
  oauth.setCredentials(token);
  const drive = google.drive({ version: 'v3', auth: oauth });

  const results = [];
  let successful = 0;
  let failed = 0;
  const fileIds = payload.fileIds || [];
  
  console.log(`[DeleteFiles] Starting deletion of ${fileIds.length} items:`, fileIds.slice(0, 3).map(id => id.substring(0, 20)));
  
  for (let i = 0; i < fileIds.length; i++) {
    const fileId = fileIds[i];
    try {
      console.log(`[DeleteFiles] Deleting ${i + 1}/${fileIds.length}: ${fileId}`);
      
      await drive.files.delete({ 
        fileId,
        supportsAllDrives: true,
        supportsTeamDrives: true
      });
      
      successful++;
      results.push({ fileId: String(fileId), status: 'deleted' });
      console.log(`[DeleteFiles] Successfully deleted: ${fileId}`);
      
      // Send progress update to UI - only serialize primitives
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('delete-progress', {
            deleted: successful,
            total: fileIds.length,
            current: String(fileId),
            status: 'deleted'
          });
        } catch (sendErr) {
          console.error('[DeleteFiles] Error sending progress:', sendErr.message);
        }
      }
    } catch (err) {
      failed++;
      const errorMsg = err && err.message ? String(err.message) : 'Unknown error';
      results.push({ fileId: String(fileId), status: 'failed', error: errorMsg });
      console.error(`[DeleteFiles] Failed to delete ${fileId}:`, err);
      if (err.errors) {
        console.error('[DeleteFiles] Error details:', JSON.stringify(err.errors, null, 2));
      }
      if (err.response) {
        console.error('[DeleteFiles] Response status:', err.response.status);
        console.error('[DeleteFiles] Response data:', err.response.data);
      }
      
      // Still send progress update even on failure - only serialize primitives
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('delete-progress', {
            deleted: successful,
            total: fileIds.length,
            current: String(fileId),
            status: 'failed'
          });
        } catch (sendErr) {
          console.error('[DeleteFiles] Error sending progress:', sendErr.message);
        }
      }
    }
    
    // Yield to prevent blocking
    await new Promise(resolve => setImmediate(resolve));
  }

  console.log(`[DeleteFiles] Deletion complete: ${successful} successful, ${failed} failed`);
  const message = `Deleted ${successful} item${successful !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}.`;
  
  // Ensure all return data is JSON-serializable
  return { 
    message: String(message), 
    successful: Number(successful), 
    failed: Number(failed), 
    results: results.map(r => ({
      fileId: String(r.fileId),
      status: String(r.status),
      error: r.error ? String(r.error) : undefined
    }))
  };
});

ipcMain.handle('empty-trash', async (_event, payload) => {
  const token = payload.token || cachedToken;
  if (!token) return { message: 'Please sign in first.' };

  const oauth = buildAuthClient();
  oauth.setCredentials(token);
  const drive = google.drive({ version: 'v3', auth: oauth });

  console.log('[EmptyTrash] Starting to empty trash...');
  
  try {
    let deletedCount = 0;
    let pageToken = null;
    
    do {
      // Find all files in trash
      const res = await drive.files.list({
        pageSize: 1000,
        fields: 'files(id, name)',
        q: 'trashed=true',
        pageToken: pageToken,
        supportsAllDrives: true,
        supportsTeamDrives: true
      });
      
      const files = res.data.files || [];
      console.log(`[EmptyTrash] Found ${files.length} trashed files`);
      
      // Permanently delete each file from trash
      for (const file of files) {
        try {
          await drive.files.delete({
            fileId: file.id,
            supportsAllDrives: true,
            supportsTeamDrives: true,
            permanent: true // Permanently delete, don't just trash
          });
          deletedCount++;
          console.log(`[EmptyTrash] Permanently deleted: ${file.name}`);
        } catch (err) {
          console.error(`[EmptyTrash] Failed to permanently delete ${file.name}:`, err.message);
        }
      }
      
      pageToken = res.data.nextPageToken || null;
    } while (pageToken);
    
    console.log(`[EmptyTrash] Permanently deleted ${deletedCount} files from trash`);
    return { 
      message: `Permanently deleted ${deletedCount} files from trash. Storage should be freed up shortly.`,
      deleted: deletedCount
    };
  } catch (err) {
    console.error('[EmptyTrash] Error:', err.message);
    return { 
      message: `Error emptying trash: ${err.message}`,
      deleted: 0
    };
  }
});

// ============ GOOGLE PHOTOS HANDLERS ============

ipcMain.handle('list-photos', async (_event, payload) => {
  const token = payload.token || cachedToken;
  if (!token) return { message: 'Please sign in first.' };

  console.log('[ListPhotos] Fetching photos from Google Photos library...');
  console.log('[ListPhotos] Token structure:', { 
    hasAccessToken: !!token.access_token, 
    tokenType: token.token_type,
    hasRefreshToken: !!token.refresh_token,
    scope: token.scope ? token.scope.substring(0, 100) : 'N/A'
  });
  
  // Check if token has required Google Photos scope
  const requiredScopes = ['https://www.googleapis.com/auth/photoslibrary'];
  if (!hasRequiredScopes(token, requiredScopes)) {
    console.error('[ListPhotos] Token missing required Google Photos scope');
    return { 
      message: 'Your authentication needs to be updated to access Google Photos. Please sign in again to grant the Google Photos permission.',
      requiresReauth: true,
      photos: [] 
    };
  }
  
  try {
    // Build OAuth client to ensure token is valid and refreshed if needed
    const oauth = buildAuthClient();
    oauth.setCredentials(token);
    
    // Get a fresh access token (will refresh if expired)
    const { token: freshToken } = await oauth.getAccessToken();
    console.log('[ListPhotos] Fresh access token obtained');
    
    let allPhotos = [];
    let pageToken = null;
    
    do {
      const body = {
        pageSize: 100,
        pageToken: pageToken || undefined
      };
      
      const response = await new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        
        console.log('[ListPhotos] Request body:', postData);
        
        const options = {
          hostname: 'photoslibrary.googleapis.com',
          path: '/v1/mediaItems:search',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${freshToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        console.log('[ListPhotos] Sending request with auth header');
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              console.log('[ListPhotos] API Response status:', res.statusCode);
              console.log('[ListPhotos] API Response:', JSON.stringify(parsed).substring(0, 500));
              resolve(parsed);
            } catch (e) {
              reject(new Error(`Failed to parse response: ${e.message}`));
            }
          });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
      });
      
      if (response.error) {
        const errorMessage = response.error.message || 'Google Photos API error';
        // Check if this is a scope-related error
        if (errorMessage.includes('insufficient') || errorMessage.includes('scope')) {
          throw new Error(`SCOPE_ERROR:${errorMessage}`);
        }
        throw new Error(errorMessage);
      }
      
      const photos = response.mediaItems || [];
      console.log(`[ListPhotos] Retrieved ${photos.length} photos (page)`);
      allPhotos = allPhotos.concat(photos);
      pageToken = response.nextPageToken || null;
    } while (pageToken);
    
    console.log(`[ListPhotos] Total photos found: ${allPhotos.length}`);
    
    // Sanitize photos for IPC
    const sanitizedPhotos = allPhotos.map((photo) => ({
      id: String(photo.id || ''),
      name: String(photo.filename || ''),
      filename: String(photo.filename || ''),
      baseUrl: String(photo.baseUrl || ''),
      mimeType: String(photo.mimeType || ''),
      mediaMetadata: photo.mediaMetadata ? {
        creationTime: String(photo.mediaMetadata.creationTime || ''),
        width: String(photo.mediaMetadata.width || ''),
        height: String(photo.mediaMetadata.height || ''),
        photo: photo.mediaMetadata.photo ? {} : null,
        video: photo.mediaMetadata.video ? {} : null
      } : null,
      productUrl: String(photo.productUrl || ''),
      source: 'photos'
    }));
    
    return { photos: sanitizedPhotos };
  } catch (err) {
    console.error('[ListPhotos] Error:', err.message);
    // Check if this is a scope-related error
    if (err.message.includes('SCOPE_ERROR')) {
      const scopeErrorMsg = err.message.replace('SCOPE_ERROR:', '');
      return { 
        message: `Google Photos access permission missing. Please sign in again to grant access. (${scopeErrorMsg})`,
        requiresReauth: true,
        photos: [] 
      };
    }
    return { message: `Error fetching photos: ${err.message}`, photos: [] };
  }
});

ipcMain.handle('import-photos', async (_event, payload) => {
  const { token, destination, files: selectedPhotos, autoDelete } = payload;
  const authToken = token || cachedToken;
  
  if (!authToken) {
    return { message: 'Please sign in first.' };
  }
  
  console.log(`[ImportPhotos] Starting import of ${selectedPhotos.length} photos to ${destination}`);
  
  let transferred = 0;
  const results = [];
  
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  for (const photo of selectedPhotos) {
    try {
      const photoUrl = photo.baseUrl + '=d'; // Add '=d' to get download version
      const fileExt = photo.filename.includes('.') ? photo.filename.substring(photo.filename.lastIndexOf('.')) : '.jpg';
      const targetPath = path.join(destination, photo.filename);
      
      console.log(`[ImportPhotos] Downloading: ${photo.filename}`);
      
      // Download photo using HTTPS
      await new Promise((resolve, reject) => {
        https.get(photoUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          
          const writeStream = fs.createWriteStream(targetPath);
          response.pipe(writeStream);
          
          writeStream.on('finish', () => {
            writeStream.close();
            resolve();
          });
          
          writeStream.on('error', (err) => {
            fs.unlink(targetPath, () => {});
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      });
      
      transferred++;
      results.push({ name: photo.filename, status: 'downloaded successfully' });
      
      if (mainWindow) {
        mainWindow.webContents.send('import-progress', {
          transferred,
          total: selectedPhotos.length,
          current: photo.filename,
          status: 'downloaded'
        });
      }
      
      // Yield to event loop every 5 files
      if (transferred % 5 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    } catch (err) {
      console.error(`[ImportPhotos] Failed to download ${photo.filename}:`, err.message);
      results.push({ name: photo.filename, status: 'failed', error: err.message });
      transferred++;
      
      if (mainWindow) {
        mainWindow.webContents.send('import-progress', {
          transferred,
          total: selectedPhotos.length,
          current: photo.filename,
          status: 'failed'
        });
      }
    }
  }
  
  return {
    message: `Transferred ${transferred} photo(s) to ${destination}`,
    results: results.map(r => ({
      name: String(r.name),
      status: String(r.status),
      error: r.error ? String(r.error) : undefined
    }))
  };
});

ipcMain.handle('delete-photos', async (_event, payload) => {
  const token = payload.token || cachedToken;
  if (!token) return { message: 'Please sign in first.' };

  console.log(`[DeletePhotos] Deleting ${payload.mediaItemIds.length} photos...`);
  
  // Check if token has required Google Photos scope
  const requiredScopes = ['https://www.googleapis.com/auth/photoslibrary'];
  if (!hasRequiredScopes(token, requiredScopes)) {
    console.error('[DeletePhotos] Token missing required Google Photos scope');
    return { 
      message: 'Your authentication needs to be updated to delete Google Photos. Please sign in again to grant the Google Photos permission.',
      requiresReauth: true
    };
  }
  
  let successful = 0;
  let failed = 0;
  const results = [];
  
  try {
    // Build OAuth client to ensure token is valid and refreshed if needed
    const oauth = buildAuthClient();
    oauth.setCredentials(token);
    
    // Get a fresh access token (will refresh if expired)
    const { token: freshToken } = await oauth.getAccessToken();
    console.log('[DeletePhotos] Fresh access token obtained');
    // Google Photos API requires batch delete with max 50 items per request
    const batchSize = 50;
    for (let i = 0; i < payload.mediaItemIds.length; i += batchSize) {
      const batch = payload.mediaItemIds.slice(i, i + batchSize);
      
      try {
        const url = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchDelete';
        const requestBody = {
          mediaItemIds: batch
        };
        
        const response = await new Promise((resolve, reject) => {
          const postData = JSON.stringify(requestBody);
          
          const options = {
            hostname: 'photoslibrary.googleapis.com',
            path: '/v1/mediaItems:batchDelete',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${freshToken}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };
          
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                // Empty response is OK for delete
                resolve({});
              }
            });
          });
          
          req.on('error', reject);
          req.write(postData);
          req.end();
        });
        
        // Process results from batch
        if (response.deleteMediaItemResults) {
          for (let j = 0; j < batch.length; j++) {
            const itemResult = response.deleteMediaItemResults[j];
            const photoId = batch[j];
            
            if (itemResult.status?.code === 0 || !itemResult.status) {
              successful++;
              results.push({ photoId, status: 'deleted' });
              console.log(`[DeletePhotos] Deleted: ${photoId}`);
              
              if (mainWindow) {
                mainWindow.webContents.send('delete-progress', {
                  deleted: successful + failed,
                  total: payload.mediaItemIds.length,
                  current: photoId,
                  status: 'deleted'
                });
              }
            } else {
              failed++;
              results.push({ 
                photoId, 
                status: 'failed', 
                error: itemResult.status?.message || 'Unknown error'
              });
              console.error(`[DeletePhotos] Failed to delete ${photoId}:`, itemResult.status?.message);
              
              if (mainWindow) {
                mainWindow.webContents.send('delete-progress', {
                  deleted: successful + failed,
                  total: payload.mediaItemIds.length,
                  current: photoId,
                  status: 'failed'
                });
              }
            }
          }
        } else {
          // Assume all succeeded if no explicit results
          successful += batch.length;
          batch.forEach(photoId => {
            results.push({ photoId, status: 'deleted' });
            console.log(`[DeletePhotos] Deleted: ${photoId}`);
            
            if (mainWindow) {
              mainWindow.webContents.send('delete-progress', {
                deleted: successful + failed,
                total: payload.mediaItemIds.length,
                current: photoId,
                status: 'deleted'
              });
            }
          });
        }
      } catch (err) {
        console.error(`[DeletePhotos] Batch error:`, err.message);
        failed += batch.length;
        batch.forEach(photoId => {
          results.push({ photoId, status: 'failed', error: err.message });
        });
      }
    }
    
    console.log(`[DeletePhotos] Complete: ${successful} successful, ${failed} failed`);
    return {
      message: `Deleted ${successful} photo(s) from Google Photos`,
      successful,
      failed,
      results
    };
  } catch (err) {
    console.error('[DeletePhotos] Error:', err.message);
    return { message: `Error: ${err.message}`, successful: 0, failed: payload.mediaItemIds.length, results: [] };
  }
});
