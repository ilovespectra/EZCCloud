const { ipcRenderer, contextBridge } = require('electron');

try {
  const onIpc = (channel, callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };

  contextBridge.exposeInMainWorld('electronAPI', {
    startAuth: () => ipcRenderer.invoke('start-auth'),
    getInitialState: () => ipcRenderer.invoke('get-initial-state'),
    listFiles: (token) => ipcRenderer.invoke('list-files', { token }),
    listPhotos: (token) => ipcRenderer.invoke('list-photos', { token }),
    pickDestination: () => ipcRenderer.invoke('pick-destination'),
    saveGoogleConfig: (config) => ipcRenderer.invoke('save-google-config', config),
    importFiles: (payload) => ipcRenderer.invoke('import-files', payload),
    importPhotos: (payload) => ipcRenderer.invoke('import-photos', payload),
    deleteFiles: (payload) => ipcRenderer.invoke('delete-files', payload),
    deletePhotos: (payload) => ipcRenderer.invoke('delete-photos', payload),
    emptyTrash: (payload) => ipcRenderer.invoke('empty-trash', payload),
    onAuthUrl: (callback) => onIpc('auth-url', callback),
    onToken: (callback) => onIpc('token', callback),
    onStatus: (callback) => onIpc('status', callback),
    onFiles: (callback) => onIpc('files', callback),
    onImportProgress: (callback) => onIpc('import-progress', callback),
    onDeleteProgress: (callback) => onIpc('delete-progress', callback)
  });
  console.log('Preload: electronAPI exposed successfully');
} catch (error) {
  console.error('Preload: Failed to expose electronAPI:', error);
}
