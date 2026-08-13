import { useEffect, useMemo, useRef, useState } from 'react';
import Landing from './pages/Landing';

const defaultGoogleConfig = {
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://127.0.0.1:3001/oauth/callback'
};

const defaultState = {
  authUrl: '',
  token: null,
  userEmail: null,
  files: [],
  selectedIds: [],
  destination: '',
  viewMode: 'grid',
  importMode: 'copy',
  autoDelete: false,
  stayLoggedIn: true,
  thumbnailSize: 140,
  googleConfig: defaultGoogleConfig,
  status: 'Ready to sign in.',
  currentFolder: null,
  breadcrumb: [],
  previewFile: null,
  transferred: 0,
  importProgress: null,
  deleteProgress: null,
  source: 'drive'
};

function App() {
  const hasElectronAPI = typeof window !== 'undefined' && !!window.electronAPI;
  const [token, setToken] = useState(defaultState.token);
  const [userEmail, setUserEmail] = useState(defaultState.userEmail);
  const [files, setFiles] = useState(defaultState.files);
  const [selectedIds, setSelectedIds] = useState(defaultState.selectedIds);
  const [destination, setDestination] = useState(defaultState.destination);
  const [viewMode, setViewMode] = useState(defaultState.viewMode);
  const [importMode, setImportMode] = useState(defaultState.importMode);
  const [autoDelete, setAutoDelete] = useState(defaultState.autoDelete);
  const [stayLoggedIn, setStayLoggedIn] = useState(defaultState.stayLoggedIn);
  const [thumbnailSize, setThumbnailSize] = useState(defaultState.thumbnailSize);
  const [googleConfig, setGoogleConfig] = useState(defaultState.googleConfig);
  const [status, setStatus] = useState(defaultState.status);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(defaultState.currentFolder);
  const [breadcrumb, setBreadcrumb] = useState(defaultState.breadcrumb);
  const [previewFile, setPreviewFile] = useState(defaultState.previewFile);
  const [transferred, setTransferred] = useState(defaultState.transferred);
  const [importProgress, setImportProgress] = useState(defaultState.importProgress);
  const [deleteProgress, setDeleteProgress] = useState(defaultState.deleteProgress);
  const [source, setSource] = useState(defaultState.source);
  const [sourceCache, setSourceCache] = useState({
    drive: { loaded: false, items: [] },
    photos: { loaded: false, items: [] }
  });
  const sourceRef = useRef(source);
  const sourceCacheRef = useRef(sourceCache);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    sourceCacheRef.current = sourceCache;
  }, [sourceCache]);

  const resetSourceViewState = () => {
    setCurrentFolder(null);
    setBreadcrumb([]);
    setTransferred(0);
    setSelectedIds([]);
  };

  const loadFilesForSource = async (targetSource, tokenToUse, options = {}) => {
    const { force = false } = options;
    const api = window.electronAPI;
    if (!api || !tokenToUse) return;

    const cached = sourceCacheRef.current[targetSource];
    if (!force && cached?.loaded) {
      setFiles(cached.items || []);
      resetSourceViewState();
      setStatus(`Loaded ${cached.items?.length || 0} ${targetSource === 'photos' ? 'photos' : 'files'} from cache.`);
      return;
    }

    if (targetSource === 'photos') {
      setStatus('Loading Google Photos...');
      const result = await api.listPhotos(tokenToUse);
      if (result.requiresReauth) {
        setStatus(`${result.message} Please click "Sign In" again.`);
        setFiles([]);
        setSourceCache(prev => ({
          ...prev,
          photos: { loaded: false, items: [] }
        }));
        return;
      }
      if (result.message && !result.photos) {
        setStatus(result.message);
        setFiles([]);
        setSourceCache(prev => ({
          ...prev,
          photos: { loaded: false, items: [] }
        }));
        return;
      }

      const photos = result.photos || [];
      setFiles(photos);
      resetSourceViewState();
      setSourceCache(prev => ({
        ...prev,
        photos: { loaded: true, items: photos }
      }));
      setStatus(`Loaded ${photos.length} photos from Google Photos.`);
      return;
    }

    setStatus('Loading Google Drive files...');
    const result = await api.listFiles(tokenToUse);
    const driveFiles = result.files || [];
    setFiles(driveFiles);
    resetSourceViewState();
    setSourceCache(prev => ({
      ...prev,
      drive: { loaded: true, items: driveFiles }
    }));
    setStatus(`Loaded ${driveFiles.length} files from Google Drive.`);
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      setStatus('Web mode detected. Open the desktop app to sign in and transfer files.');
      return;
    }

    console.log('[App] Setting up IPC listeners...');

    // Set up token listener
    const unlistenToken = api.onToken((value) => {
      console.log('[App] Token received:', value ? 'valid' : 'empty');
      setToken(value);
      if (value) {
        setStatus('Signed in. Loading Drive files…');
        // Extract email from token if available
        if (value.id_token) {
          try {
            const parts = value.id_token.split('.');
            const decoded = JSON.parse(atob(parts[1]));
            setUserEmail(decoded.email);
          } catch (e) {
            console.log('[App] Could not decode email from token');
          }
        }
        console.log('[App] Calling source loader after token...');
        loadFilesForSource(sourceRef.current, value).catch((err) => {
          console.error('[App] Error loading source after token:', err);
          setStatus(`Error loading files: ${err.message}`);
        });
      }
    });

    const unlistenStatus = api.onStatus((message) => {
      console.log('[App] Status:', message);
      setStatus(message);
    });

    const unlistenFiles = api.onFiles((result) => {
      console.log('[App] Files received:', {
        count: result.files?.length,
        sample: result.files?.slice(0, 5).map(f => ({ id: f.id, name: f.name, parentPath: f.parentPath, isFolder: f.mimeType === 'application/vnd.google-apps.folder' }))
      });
      const nextFiles = result.files || [];
      setFiles(nextFiles);
      setSourceCache(prev => ({
        ...prev,
        drive: { loaded: true, items: nextFiles }
      }));
    });

    const unlistenImportProgress = api.onImportProgress((progress) => {
      console.log('[App] Import progress:', progress);
      setImportProgress(progress);
      setStatus(`Transferring... ${progress.current}`);
    });

    const unlistenDeleteProgress = api.onDeleteProgress((progress) => {
      console.log('[App] Delete progress:', progress);
      setDeleteProgress(progress);
      setStatus(`Deleting... ${progress.current}`);
    });

    // Load initial state
    console.log('[App] Loading initial state...');
    api.getInitialState().then((state) => {
      console.log('[App] Initial state loaded:', state);
      if (state?.token) {
        console.log('[App] Restoring token from session');
        setToken(state.token);
        setDestination(state.destination || '');
        const initialFiles = state.files || [];
        setFiles(initialFiles);
        setSourceCache(prev => ({
          ...prev,
          drive: { loaded: true, items: initialFiles }
        }));
        
        // Extract email from token if available
        if (state.token.id_token) {
          try {
            const parts = state.token.id_token.split('.');
            const decoded = JSON.parse(atob(parts[1]));
            setUserEmail(decoded.email);
          } catch (e) {
            console.log('[App] Could not decode email from token');
          }
        }
        
        // Load files automatically if stayLoggedIn is true
        if (stayLoggedIn !== false) {
          console.log('[App] Auto-loading files with restored token');
          const hasSessionFiles = initialFiles.length > 0;
          loadFilesForSource('drive', state.token, { force: !hasSessionFiles }).then(() => {
            console.log('[App] Auto-loaded drive files');
            setStatus('Restored previous session.');
          }).catch((err) => {
            console.error('[App] Error auto-loading files:', err);
            setStatus('Restored session but files need to reload.');
          });
        } else {
          setStatus('Restored previous session.');
        }
      }
      if (state?.googleConfig) {
        setGoogleConfig(state.googleConfig);
      }
    }).catch((err) => {
      console.error('[App] Error loading initial state:', err);
    });

    // Cleanup listeners
    return () => {
      console.log('[App] Cleaning up listeners');
      if (typeof unlistenToken === 'function') unlistenToken();
      if (typeof unlistenStatus === 'function') unlistenStatus();
      if (typeof unlistenFiles === 'function') unlistenFiles();
      if (typeof unlistenImportProgress === 'function') unlistenImportProgress();
      if (typeof unlistenDeleteProgress === 'function') unlistenDeleteProgress();
    };
  }, []);

  // Memoized selected files list
  const selectedFiles = useMemo(() => files.filter((file) => selectedIds.includes(file.id)), [files, selectedIds]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const openFolder = (folder) => {
    if (folder.mimeType === 'application/vnd.google-apps.folder') {
      // Filter all files to show only direct children of this folder
      const childrenFiles = files.filter(f => f.parentPath === folder.id);
      
      console.log('[App] Opening folder:', {
        folderId: folder.id,
        folderName: folder.name,
        childrenCount: childrenFiles.length,
        totalFiles: files.length,
        expectedParentPath: folder.id,
        filesWithThisParent: files.filter(f => f.parentPath === folder.id).map(f => ({ id: f.id, name: f.name }))
      });
      
      setCurrentFolder(folder);
      setBreadcrumb([...breadcrumb, folder]);
      setStatus(`Opened folder: ${folder.name} (${childrenFiles.length} items)`);
    }
  };

  const goBackFolder = () => {
    if (breadcrumb.length === 0) {
      // Go back to root
      setCurrentFolder(null);
      setBreadcrumb([]);
      setStatus(`Viewing all files`);
      return;
    }
    
    const newBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(newBreadcrumb);
    
    if (newBreadcrumb.length === 0) {
      setCurrentFolder(null);
      setStatus('Viewing all files');
    } else {
      const parentFolder = newBreadcrumb[newBreadcrumb.length - 1];
      setCurrentFolder(parentFolder);
      setStatus(`Viewing: ${parentFolder.name}`);
    }
  };

  const getDisplayFiles = () => {
    if (!currentFolder) {
      // Show only root-level files (parentPath is null or empty)
      const rootFiles = files.filter(f => !f.parentPath);
      console.log('[App] Filtering root files:', {
        total: files.length,
        root: rootFiles.length,
        sample: rootFiles.slice(0, 3).map(f => ({ id: f.id, name: f.name, parentPath: f.parentPath }))
      });
      return rootFiles;
    }
    // Show only direct children of current folder
    const childFiles = files.filter(f => f.parentPath === currentFolder.id);
    console.log('[App] Filtering folder children:', {
      folderId: currentFolder.id,
      folderName: currentFolder.name,
      total: files.length,
      children: childFiles.length,
      sample: childFiles.slice(0, 3).map(f => ({ id: f.id, name: f.name, parentPath: f.parentPath }))
    });
    return childFiles;
  };

  const toggleSelectFolder = (folderId) => {
    // When selecting a folder, also select all its children
    const folder = files.find(f => f.id === folderId);
    if (folder && folder.mimeType === 'application/vnd.google-apps.folder') {
      const childIds = files.filter(f => f.parentPath === folder.id).map(f => f.id);
      
      if (selectedIds.includes(folderId)) {
        // Deselect folder and all children
        const idsToRemove = [folderId, ...childIds];
        setSelectedIds(prev => prev.filter(id => !idsToRemove.includes(id)));
      } else {
        // Select folder and all children
        const idsToAdd = [folderId, ...childIds];
        setSelectedIds(prev => [...new Set([...prev, ...idsToAdd])]);
      }
    } else {
      // Regular file toggle
      toggleSelect(folderId);
    }
  };

  const isImage = (mimeType) => mimeType?.startsWith('image/');
  const isVideo = (mimeType) => mimeType?.startsWith('video/');
  const isAudio = (mimeType) => mimeType?.startsWith('audio/');
  const isFolder = (mimeType) => mimeType === 'application/vnd.google-apps.folder';
  const isDocument = (mimeType) => mimeType?.includes('document') || mimeType?.includes('text');

  const selectAll = () => {
    // Select ALL files from the entire drive, not just the current folder view
    const allIds = files.map(f => f.id);
    setSelectedIds(allIds);
    setStatus(`Selected all ${allIds.length} files from entire drive`);
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };


  const pickDestination = async () => {
    const chosen = await window.electronAPI.pickDestination();
    if (chosen) setDestination(chosen);
  };

  const saveGoogleSettings = async () => {
    if (!window.electronAPI) {
      throw new Error('Electron bridge was not loaded.');
    }
    try {
      await window.electronAPI.saveGoogleConfig(googleConfig);
    } catch (error) {
      console.error('[App] Error saving Google config:', error);
      throw error;
    }
  };

  const startAuth = async () => {
    console.log('[App] startAuth called');
    if (authInProgress) {
      return;
    }

    setAuthInProgress(true);
    try {
      console.log('[App] Checking electronAPI:', !!window.electronAPI);
      if (!window.electronAPI) {
        console.error('[App] electronAPI is not available');
        setStatus('Electron bridge was not loaded.');
        return;
      }
      console.log('[App] Saving Google settings...');
      await saveGoogleSettings();
      console.log('[App] Settings saved, starting auth...');
      setStatus('Launching Google sign-in…');
      const result = await window.electronAPI.startAuth();
      console.log('[App] Auth started, result:', result);
    } catch (error) {
      console.error('[App] Error in startAuth:', error);
      setStatus(`Sign-in error: ${error?.message || String(error)}`);
    } finally {
      setAuthInProgress(false);
    }
  };

  const importSelected = async () => {
    // Prevent duplicate imports
    if (importProgress !== null) {
      setStatus('Import already in progress. Please wait...');
      return;
    }

    if (!token || !destination) {
      setStatus('Choose a destination folder first.');
      return;
    }
    if (!selectedFiles.length) {
      setStatus('Select at least one file to import.');
      return;
    }
    
    // Count only actual files, not folders (for Drive) or all items (for Photos)
    const fileCount = source === 'photos' 
      ? selectedFiles.length 
      : selectedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length;
    
    setStatus(`Importing ${source === 'photos' ? 'photos' : 'files'}…`);
    setImportProgress({ transferred: 0, total: fileCount, current: 'starting...', status: 'starting', bytesTransferred: 0, totalBytes: 0 });
    
    try {
      const result = source === 'photos'
        ? await window.electronAPI.importPhotos({
            token,
            destination,
            files: selectedFiles,
            autoDelete
          })
        : await window.electronAPI.importFiles({
            token,
            destination,
            files: selectedFiles,
            mode: importMode,
            autoDelete
          });
      
      setImportProgress(null);
      setSelectedIds([]);
      setStatus(result.message || 'Import complete.');
    } catch (err) {
      setImportProgress(null);
      setStatus(`Import failed: ${err.message}`);
      console.error('Import error:', err);
    }
  };

  const deleteSelected = async () => {
    console.log('[App] deleteSelected called. deleteProgress:', deleteProgress, 'selectedIds:', selectedIds.length, 'selectedFiles:', selectedFiles.length);
    
    if (selectedIds.length > 0 && selectedFiles.length === 0) {
      console.log('[App] WARNING: selectedIds present but selectedFiles empty. This suggests ID mismatch.');
      console.log('[App] selectedIds:', selectedIds);
      console.log('[App] Sample file IDs from list:', files.slice(0, 3).map(f => f.id));
    }
    
    // Prevent duplicate deletes
    if (deleteProgress !== null) {
      console.log('[App] Delete already in progress');
      setStatus('Delete already in progress. Please wait...');
      return;
    }

    if (!selectedFiles.length) {
      console.log('[App] No files selected');
      setStatus('Select at least one item to delete.');
      return;
    }
    
    let confirmMsg;
    let totalCount;
    
    if (source === 'photos') {
      totalCount = selectedFiles.length;
      confirmMsg = `Are you sure you want to permanently delete ${totalCount} photo${totalCount !== 1 ? 's' : ''} from Google Photos?\n\nThis action cannot be undone.`;
    } else {
      const fileCount = selectedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length;
      const folderCount = selectedFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;
      totalCount = fileCount + folderCount;
      confirmMsg = `Are you sure you want to permanently delete ${fileCount} file${fileCount !== 1 ? 's' : ''}${folderCount > 0 ? ` and ${folderCount} folder${folderCount !== 1 ? 's' : ''}` : ''}?\n\nThis action cannot be undone.`;
    }
    
    if (!window.confirm(confirmMsg)) {
      setStatus('Delete cancelled.');
      return;
    }
    
    setStatus(`Deleting selected items from Google ${source === 'photos' ? 'Photos' : 'Drive'}...`);
    setDeleteProgress({ deleted: 0, total: totalCount, current: 'starting...', status: 'deleting' });
    
    try {
      const result = source === 'photos'
        ? await window.electronAPI.deletePhotos({ 
            token, 
            mediaItemIds: selectedIds
          })
        : await window.electronAPI.deleteFiles({ 
            token, 
            fileIds: selectedIds
          });
      
      console.log('[App] Delete result:', result);
      const failedResults = result.results.filter(r => r.status === 'failed');
      if (failedResults.length > 0) {
        console.log('[App] Delete errors:');
        failedResults.forEach(r => {
          console.log(`  - ${r.photoId || r.fileId}: ${r.error}`);
        });
      }
      setDeleteProgress(null);
      setStatus(result.message || `Deleted ${result.successful} item${result.successful !== 1 ? 's' : ''}.`);
      setSelectedIds([]);
      
      // Reload files list to reflect deletions
      if (token) {
        await loadFilesForSource(source, token, { force: true });
      }
    } catch (err) {
      setDeleteProgress(null);
      setStatus(`Delete failed: ${err.message}`);
      console.error('Delete error:', err);
    }
  };

  const signOut = () => {
    setToken(null);
    setUserEmail(null);
    setFiles([]);
    setSelectedIds([]);
    setTransferred(0);
    setPreviewFile(null);
    setSourceCache({
      drive: { loaded: false, items: [] },
      photos: { loaded: false, items: [] }
    });
    setStatus('Ready to sign in.');
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Permanently delete all files in trash? This will free up storage on Google Drive but cannot be undone.')) {
      return;
    }
    
    setStatus('Emptying trash...');
    try {
      const result = await window.electronAPI.emptyTrash({ token });
      setStatus(result.message);
      console.log('Empty trash result:', result);
    } catch (err) {
      setStatus(`Error emptying trash: ${err.message}`);
      console.error('Empty trash error:', err);
    }
  };

  // Show landing page if not authenticated
  if (!token) {
    return <Landing onSignIn={startAuth} status={status} authInProgress={authInProgress} canSignIn={hasElectronAPI} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>EZC-Cloud Transfer</h1>
          <p>Move Google Drive files to your Mac with simple authentication and bulk actions.</p>
        </div>
        {token && userEmail ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>Logged in as <strong>{userEmail}</strong></span>
            <label className="checkbox" style={{ margin: 0 }}>
              <input type="checkbox" checked={stayLoggedIn} onChange={(e) => setStayLoggedIn(e.target.checked)} />
              Stay logged in
            </label>
            <button className="google-btn" onClick={signOut}>
              Sign out
            </button>
            <button className="secondary-btn" onClick={() => handleEmptyTrash()} title="Permanently delete all files in trash to free up storage">
              Empty Trash
            </button>
          </div>
        ) : (
          <button className="google-btn" onClick={(e) => {
            console.log('[App] Header sign-in button clicked', e);
            startAuth();
          }}>
            <span className="google-mark" aria-hidden="true">G</span>
            <span>Sign in with Google</span>
          </button>
        )}
      </header>

      <section className="toolbar">
        <fieldset style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          <legend style={{ padding: '0 5px', fontWeight: 'bold' }}>Data Source</legend>
          <div style={{ display: 'flex', gap: '20px' }}>
            <label className="radio-label">
              <input 
                type="radio" 
                name="source" 
                value="drive" 
                checked={source === 'drive'} 
                onChange={(e) => {
                  const nextSource = e.target.value;
                  setSource(nextSource);
                  if (token) {
                    loadFilesForSource(nextSource, token).catch((err) => {
                      setStatus(`Error loading files: ${err.message}`);
                    });
                  }
                }}
              />
              Google Drive
            </label>
            <label className="radio-label">
              <input 
                type="radio" 
                name="source" 
                value="photos" 
                checked={source === 'photos'} 
                onChange={(e) => {
                  const nextSource = e.target.value;
                  setSource(nextSource);
                  if (token) {
                    loadFilesForSource(nextSource, token).catch((err) => {
                      setStatus(`Error loading photos: ${err.message}`);
                    });
                  }
                }}
              />
              Google Photos
            </label>
          </div>
        </fieldset>

        <label>
          Destination
          <div className="inline-row">
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="/Users/you/Desktop/Imports" />
            <button onClick={pickDestination}>Choose</button>
          </div>
        </label>

        <label>
          View
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="grid">Grid</option>
            <option value="icons">Icons</option>
          </select>
        </label>

        <button onClick={selectAll} title="Select all files">Select All</button>
        <button onClick={deselectAll} title="Deselect all files">Deselect All</button>

        <label>
          Import mode
          <select value={importMode} onChange={(e) => setImportMode(e.target.value)}>
            <option value="copy">Copy</option>
            <option value="move">Move</option>
          </select>
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={autoDelete} onChange={(e) => setAutoDelete(e.target.checked)} />
          Delete from Drive after import
        </label>

        <label>
          Thumbnail size
          <input type="range" min="96" max="220" step="8" value={thumbnailSize} onChange={(e) => setThumbnailSize(Number(e.target.value))} />
        </label>
      </section>

      <section className="status-row">
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '8px' }}>
            <span>{status}</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', fontSize: '14px' }}>
            <div style={{ flex: 1, maxWidth: '400px' }}>
              {importProgress ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Transferring: {importProgress.transferred}/{importProgress.total}</span>
                    <span>{importProgress.current}</span>
                  </div>
                  <div style={{ width: '100%', background: '#e0e0e0', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        background: '#4caf50', 
                        height: '100%', 
                        width: `${importProgress.total > 0 ? (importProgress.transferred / importProgress.total) * 100 : 0}%`, 
                        transition: 'width 0.3s' 
                      }}
                    ></div>
                  </div>
                </>
              ) : deleteProgress ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Deleting: {deleteProgress.deleted}/{deleteProgress.total}</span>
                    <span>{deleteProgress.current}</span>
                  </div>
                  <div style={{ width: '100%', background: '#e0e0e0', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        background: '#ff9800', 
                        height: '100%', 
                        width: `${deleteProgress.total > 0 ? (deleteProgress.deleted / deleteProgress.total) * 100 : 0}%`, 
                        transition: 'width 0.3s' 
                      }}
                    ></div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Files selected: {selectedIds.length}/{files.length}</span>
                  </div>
                  <div style={{ width: '100%', background: '#e0e0e0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#4caf50', height: '100%', width: `${files.length > 0 ? (selectedIds.length / files.length) * 100 : 0}%`, transition: 'width 0.3s' }}></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="actions">
          <button onClick={importSelected} disabled={importProgress !== null || deleteProgress !== null}>Import selected ({selectedIds.length})</button>
          <button className="danger" onClick={deleteSelected} disabled={importProgress !== null || deleteProgress !== null}>Delete selected ({selectedIds.length})</button>
        </div>
      </section>


      <section className={`file-list ${viewMode}`}>
        {breadcrumb.length > 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '10px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '10px', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button onClick={goBackFolder} style={{ background: '#2196F3', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>← Back</button>
            <span>📁</span>
            {breadcrumb.map((folder, idx) => (
              <span key={folder.id}>{folder.name}{idx < breadcrumb.length - 1 ? ' / ' : ''}</span>
            ))}
          </div>
        )}
        {getDisplayFiles().length === 0 && token && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            <p>{currentFolder ? `No files in "${currentFolder.name}"` : 'No files found. Make sure the Google Drive API is enabled in your Google Cloud project.'}</p>
            {!currentFolder && <p><a href="https://console.developers.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer">Enable Google Drive API</a></p>}
          </div>
        )}
        {(() => {
          const displayFiles = getDisplayFiles();
          const ids = displayFiles.map(f => f.id);
          const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
          if (duplicates.length > 0) {
            console.warn('[App] Duplicate file IDs detected:', duplicates);
          }
          return displayFiles.map((file) => (
          <div
            key={file.id}
            className={`file-card ${selectedIds.includes(file.id) ? 'selected' : ''}`}
            style={{ position: 'relative' }}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(file.id)}
              onChange={() => toggleSelectFolder(file.id)}
              style={{ position: 'absolute', top: '8px', left: '8px', width: '20px', height: '20px', zIndex: 10, cursor: 'pointer' }}
            />
            <div className="thumb" style={{ width: thumbnailSize, height: thumbnailSize, cursor: 'pointer' }} onClick={() => setPreviewFile(file)}>
              {file.thumbnail && !isVideo(file.mimeType) ? (
                <img src={file.thumbnail} alt={file.name} />
              ) : isVideo(file.mimeType) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', fontSize: '24px', width: '100%', height: '100%' }}>
                  ▶️
                </div>
              ) : isAudio(file.mimeType) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#6c5ce7', color: '#fff', fontSize: '24px', width: '100%', height: '100%' }}>
                  🎵
                </div>
              ) : isFolder(file.mimeType) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#74b9ff', color: '#fff', fontSize: '32px', width: '100%', height: '100%', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); openFolder(file); }}>
                  📁
                </div>
              ) : isDocument(file.mimeType) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4a90e2', color: '#fff', fontSize: '24px', width: '100%', height: '100%' }}>
                  📄
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#95a5a6', color: '#fff', fontSize: '24px', width: '100%', height: '100%' }}>
                  📦
                </div>
              )}
            </div>
            <div className="meta">
              <strong>{file.name}</strong>
              <small>{file.mimeType || 'file'}</small>
              {file.size && <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>}
            </div>
          </div>
          ));
        })()}
      </section>
      {previewFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPreviewFile(null)}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '80vw', maxHeight: '80vh', overflow: 'auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewFile(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            <div style={{ marginTop: '20px' }}>
              <h3>{previewFile.name}</h3>
              {isFolder(previewFile.mimeType) && (
                <div style={{ background: '#74b9ff', color: '#fff', padding: '40px', textAlign: 'center', borderRadius: '4px', marginBottom: '15px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
                  <div>Folder with {files.filter(f => f.parentPath === previewFile.id).length} items</div>
                </div>
              )}
              {previewFile.thumbnail && !isVideo(previewFile.mimeType) && !isFolder(previewFile.mimeType) ? (
                <img src={previewFile.thumbnail} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '60vh', marginBottom: '15px' }} />
              ) : isVideo(previewFile.mimeType) ? (
                <div style={{ background: '#000', color: '#fff', padding: '40px', textAlign: 'center', borderRadius: '4px', marginBottom: '15px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>▶️</div>
                  <div>Video file - Download to play</div>
                </div>
              ) : isAudio(previewFile.mimeType) ? (
                <div style={{ background: '#6c5ce7', color: '#fff', padding: '40px', textAlign: 'center', borderRadius: '4px', marginBottom: '15px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎵</div>
                  <div>Audio file - Download to play</div>
                </div>
              ) : null}
              <p><strong>Type:</strong> {isFolder(previewFile.mimeType) ? 'Google Drive Folder' : previewFile.mimeType || 'Unknown'}</p>
              {previewFile.size && !isFolder(previewFile.mimeType) && <p><strong>Size:</strong> {(previewFile.size / 1024 / 1024).toFixed(2)} MB</p>}
              {previewFile.modifiedTime && <p><strong>Modified:</strong> {new Date(previewFile.modifiedTime).toLocaleString()}</p>}
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <label className="checkbox">
                  <input type="checkbox" checked={selectedIds.includes(previewFile.id)} onChange={() => toggleSelectFolder(previewFile.id)} />
                  {isFolder(previewFile.mimeType) ? 'Select folder & contents' : 'Select for import'}
                </label>
                {isFolder(previewFile.mimeType) && (
                  <button onClick={() => { openFolder(previewFile); setPreviewFile(null); }} style={{ padding: '5px 15px', background: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Open folder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
