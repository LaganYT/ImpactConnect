# TODO

## New Features
- Allow admins to kick and ban people from rooms, there should be a right click menu for admins when clicking on users in the room sidebar
- Add LTunes support

## Bug fixes

**You are working on the ban system, test it and make improvements**


[01:04:59.127] Running build in Washington, D.C., USA (East) – iad1
[01:04:59.127] Build machine configuration: 2 cores, 8 GB
[01:04:59.175] Cloning github.com/LaganYT/ImpactConnect (Branch: bansystem, Commit: bc04284)
[01:04:59.438] Cloning completed: 262.000ms
[01:05:01.941] Restored build cache from previous deployment (G5QpF2KqoCgKJVrKK4cEADvZZniG)
[01:05:05.876] Running "vercel build"
[01:05:06.368] Vercel CLI 44.7.3
[01:05:06.713] Installing dependencies...
[01:05:08.386] 
[01:05:08.387] up to date in 1s
[01:05:08.387] 
[01:05:08.388] 221 packages are looking for funding
[01:05:08.388]   run `npm fund` for details
[01:05:08.419] Detected Next.js version: 15.4.6
[01:05:08.424] Running "npm run build"
[01:05:08.534] 
[01:05:08.535] > impactconnect@1.0.0 build
[01:05:08.535] > next build
[01:05:08.535] 
[01:05:09.694]    ▲ Next.js 15.4.6
[01:05:09.695]    - Experiments (use with caution):
[01:05:09.695]      · serverActions
[01:05:09.695] 
[01:05:09.725]    Creating an optimized production build ...
[01:05:14.725]  ⚠ Compiled with warnings in 4.0s
[01:05:14.725] 
[01:05:14.726] ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
[01:05:14.727] Critical dependency: the request of a dependency is an expression
[01:05:14.727] 
[01:05:14.727] Import trace for requested module:
[01:05:14.727] ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
[01:05:14.727] ./node_modules/@supabase/realtime-js/dist/module/index.js
[01:05:14.727] ./node_modules/@supabase/supabase-js/dist/module/index.js
[01:05:14.727] ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
[01:05:14.727] ./node_modules/@supabase/ssr/dist/module/index.js
[01:05:14.727] ./app/auth/callback/route.ts
[01:05:14.727] 
[01:05:19.810]  ✓ Compiled successfully in 6.0s
[01:05:19.816]    Linting and checking validity of types ...
[01:05:26.214] 
[01:05:26.215] Failed to compile.
[01:05:26.215] 
[01:05:26.215] ./app/api/impactstream/resolve/route.ts
[01:05:26.215] 70:12  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.215] 
[01:05:26.215] ./app/api/url/preview/route.ts
[01:05:26.215] 133:12  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.215] 
[01:05:26.215] ./app/invite/[code]/page.tsx
[01:05:26.216] 23:19  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
[01:05:26.216] 
[01:05:26.216] ./components/AdminContextMenu.tsx
[01:05:26.216] 30:3  Warning: 'currentUser' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.216] 
[01:05:26.216] ./components/BannedUsersModal.tsx
[01:05:26.216] 19:3  Warning: 'currentUser' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.216] 31:6  Warning: React Hook useEffect has a missing dependency: 'fetchBannedUsers'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
[01:05:26.216] 80:33  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
[01:05:26.216] 
[01:05:26.217] ./components/ChatLayout.tsx
[01:05:26.217] 59:6  Warning: React Hook useEffect has missing dependencies: 'fetchChatSessions' and 'setupRealtimeSubscriptions'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
[01:05:26.217] 
[01:05:26.217] ./components/ChatWindow.tsx
[01:05:26.217] 84:10  Warning: 'inviteCode' is assigned a value but never used.  @typescript-eslint/no-unused-vars
[01:05:26.217] 84:22  Warning: 'setInviteCode' is assigned a value but never used.  @typescript-eslint/no-unused-vars
[01:05:26.217] 301:6  Warning: React Hook useEffect has missing dependencies: 'fetchMessages', 'setupMessageSubscription', 'setupNicknameSync', 'setupReadReceiptsSubscription', and 'setupTypingPresence'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
[01:05:26.217] 557:6  Warning: React Hook useEffect has a missing dependency: 'selectedChat'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
[01:05:26.217] 1338:6  Warning: React Hook useEffect has missing dependencies: 'readByMap', 'supabase', and 'user.id'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
[01:05:26.217] 1545:45  Warning: 'node' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.218] 1572:37  Warning: img elements must have an alt prop, either with meaningful text, or an empty string for decorative images.  jsx-a11y/alt-text
[01:05:26.218] 
[01:05:26.223] ./components/NicknameModal.tsx
[01:05:26.223] 142:15  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
[01:05:26.223] 
[01:05:26.223] ./components/SettingsPanel.tsx
[01:05:26.224] 35:14  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.224] 118:14  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.224] 136:14  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.224] 
[01:05:26.224] ./components/Sidebar.tsx
[01:05:26.224] 9:8  Warning: 'InputModal' is defined but never used.  @typescript-eslint/no-unused-vars
[01:05:26.224] 
[01:05:26.225] info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
[01:05:26.257] Error: Command "npm run build" exited with 1