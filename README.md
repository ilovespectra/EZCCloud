# EZCCloud Transfer

A simple standalone Electron desktop app for importing Google Drive files to a Mac destination folder.

## Features
- Google sign-in flow using the standard OAuth route
- Browse Drive files as a resizable grid or icon view
- Select files in bulk and import them to a chosen local folder
- Optional automatic deletion from Drive after import
- Lightweight local session persistence

## Setup
1. Install dependencies with `npm install`
2. Export your Google OAuth credentials:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. Start the app with `npm run dev`

> For a production-style local test, you can also run `npm run build` followed by `npm start`.
# EZCCloud
