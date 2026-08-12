const { ipcRenderer, contextBridge } = require('electron');

try {
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
    onAuthUrl: (callback) => ipcRenderer.on('auth-url', (_event, value) => callback(value)),
    onToken: (callback) => ipcRenderer.on('token', (_event, value) => callback(value)),
    onStatus: (callback) => ipcRenderer.on('status', (_event, value) => callback(value)),
    onFiles: (callback) => ipcRenderer.on('files', (_event, value) => callback(value)),
    onImportProgress: (callback) => ipcRenderer.on('import-progress', (_event, value) => callback(value)),
    onDeleteProgress: (callback) => ipcRenderer.on('delete-progress', (_event, value) => callback(value))
  });
  console.log('Preload: electronAPI exposed successfully');
} catch (error) {
  console.error('Preload: Failed to expose electronAPI:', error);
}
