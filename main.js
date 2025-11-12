/*
  main.js — client-side logic for owner-only uploads of anchor links.
  NOTE: This demo uses a client-side password. It's not secure for production.
  Change OWNER_PASSWORD below before using.
*/

const OWNER_PASSWORD = 'owner123'; // change this value to secure your demo (legacy default)
const STORAGE_KEY = 'anchor_links_v1';
const OWNER_HASH_KEY = 'owner_pwd_hash_v1';
let isOwner = false;
const VIDEO_STORAGE_KEY = 'youtube_videos_v1';
const PINNED_VIDEO_KEY = 'pinned_video_v1';
const PDF_STORAGE_KEY = 'pdf_docs_v1';
const PDF_FILE_DB = 'pdf_files_db_v1';
const PDF_FILE_STORE = 'files';

// API Base URL — set this to your backend URL (e.g., https://job-shob-backend.onrender.com)
// If empty string, uses relative paths (works when backend serves frontend)
let API_BASE_URL = '';

document.addEventListener('DOMContentLoaded', init);

function init() {
  document.getElementById('year').textContent = new Date().getFullYear();

  // Navigation
  document.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', navClick));
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle) navToggle.addEventListener('click', toggleNav);
  const navClose = document.querySelector('.nav-close');
  if (navClose) navClose.addEventListener('click', (e) => {
    e.preventDefault();
    closeNav();
  });

  // Admin (modal)
  const loginBtn = document.getElementById('settings-btn'); // kept same ID for compatibility
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalContent = modalBackdrop.querySelector('.modal-content');
  
  // Open modal handler
  if (loginBtn) {
    loginBtn.addEventListener('click', openModal);
  }

  // Close button handler
  if (modalClose) {
    modalClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from reaching backdrop
      closeModal(e);
    });
  }

  // Backdrop click handler
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', backdropClick);
  }
  
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('add-link-form').addEventListener('submit', handleAddLink);
  document.getElementById('btn-change-password').addEventListener('click', handleChangePassword);
  // Video management (owner)
  const addVideoForm = document.getElementById('add-video-form');
  if (addVideoForm) addVideoForm.addEventListener('submit', handleAddVideo);
  const addPdfForm = document.getElementById('add-pdf-form');
  if (addPdfForm) addPdfForm.addEventListener('submit', handleAddPdf);

  loadLinks();
  loadVideos();
  loadPinnedVideo();
  loadPdfs();
  // Prefer server-sourced data when available
  fetchAllServerData().then(() => {
    renderLinks();
    renderVideos();
    renderPinnedVideo();
    renderPdfs();
  }).catch(() => {
    // fallback to local renders
    renderLinks();
    renderVideos();
    renderPinnedVideo();
    renderPdfs();
  });

  // Setup realtime socket listeners
  setupRealtime();
  // Don't show settings on load, only when clicking gear icon
  document.getElementById('modal-backdrop').classList.add('hidden');
  
  // Restore route from URL (for bookmarks and direct navigation)
  restoreRouteFromURL();
}

/* Realtime setup using Socket.IO client */
function setupRealtime() {
  try {
    const socket = io();

    socket.on('connect', () => {
      console.log('Realtime: connected to server');
    });

    socket.on('new:link', (link) => {
      window._links = window._links || [];
      // avoid duplicates if already present
      if (!window._links.find(l => l._id ? l._id === link._id : l.id === link.id)) {
        window._links.unshift(link);
        saveLinks();
        renderLinks();
      }
    });

    socket.on('deleted:link', ({ id }) => {
      window._links = (window._links || []).filter(l => (l._id || l.id) !== id);
      saveLinks();
      renderLinks();
    });

    socket.on('new:video', (video) => {
      window._videos = window._videos || [];
      if (!window._videos.find(v => (v._id || v.id) === (video._id || video.id))) {
        window._videos.unshift(video);
        saveVideos();
        renderVideos();
      }
    });

    socket.on('deleted:video', ({ id }) => {
      window._videos = (window._videos || []).filter(v => (v._id || v.id) !== id);
      saveVideos();
      renderVideos();
    });

    socket.on('pinned:video', (video) => {
      // server sends the pinned video document
      window._pinnedVideo = video;
      savePinnedVideo();
      renderPinnedVideo();
      renderVideos();
    });

    socket.on('new:pdf', (pdf) => {
      // PDFs returned by API include fileKey/filename; push into list
      window._pdfs = window._pdfs || [];
      if (!window._pdfs.find(p => (p._id || p.id) === (pdf._id || pdf.id))) {
        window._pdfs.unshift(pdf);
        savePdfs();
        renderPdfs();
      }
    });

    socket.on('deleted:pdf', ({ id }) => {
      window._pdfs = (window._pdfs || []).filter(p => (p._id || p.id) !== id);
      savePdfs();
      renderPdfs();
    });

    socket.on('disconnect', () => console.log('Realtime: disconnected'));
  } catch (err) {
    console.warn('Realtime: Socket.IO not available', err);
  }
}

/* Get API base URL — works both locally and after deployment */
function getApiBase() {
  // If explicitly set, use it
  if (API_BASE_URL) return API_BASE_URL;
  // Local dev: use relative paths
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }
  // Production: if backend and frontend served from different origins, you MUST set API_BASE_URL
  // For now, assume same origin (backend serves both)
  return '';
}

/* Fetch latest lists from server APIs and store locally */
async function fetchAllServerData() {
  const base = getApiBase();
  try {
    const [linksRes, videosRes, pdfsRes] = await Promise.all([
      fetch(base + '/api/links'),
      fetch(base + '/api/videos'),
      fetch(base + '/api/pdfs')
    ]);
    if (linksRes.ok) {
      const links = await linksRes.json();
      window._links = links || [];
      saveLinks();
    }
    if (videosRes.ok) {
      const videos = await videosRes.json();
      window._videos = videos || [];
      saveVideos();
    }
    if (pdfsRes.ok) {
      const pdfs = await pdfsRes.json();
      window._pdfs = pdfs || [];
      savePdfs();
    }
  } catch (err) {
    console.warn('Failed to fetch server data, using local data instead', err);
    throw err;
  }
}

function toggleNav() {
  const list = document.getElementById('nav-list');
  const btn = document.querySelector('.nav-toggle');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  // Toggle class which CSS will animate (max-height, opacity, transform)
  const navEl = document.querySelector('.nav');
  if (expanded) {
    list.classList.remove('visible');
    // remove 'open' state from nav container
    if (navEl) navEl.classList.remove('open');
  } else {
    list.classList.add('visible');
    // add 'open' state so CSS can reveal the close button
    if (navEl) navEl.classList.add('open');
  }
  btn.setAttribute('aria-expanded', String(!expanded));
  // Mark nav list for assistive tech
  list.setAttribute('aria-hidden', String(expanded));
}

function closeNav(){
  const list = document.getElementById('nav-list');
  const btn = document.querySelector('.nav-toggle');
  const navEl = document.querySelector('.nav');
  if (!list || !btn) return;
  list.classList.remove('visible');
  // remove the open flag so CSS hides the close button
  if (navEl) navEl.classList.remove('open');
  btn.setAttribute('aria-expanded','false');
  list.setAttribute('aria-hidden','true');
}

function navClick(e) {
  e.preventDefault();
  const target = e.currentTarget.getAttribute('data-target');
  const section = document.getElementById(target);
  if (section) {
    // Update the URL to reflect the current page (without page reload)
    window.history.pushState({ section: target }, '', '/' + target);
    // Close mobile nav if open
    closeNav();
    // Scroll to section
    section.scrollIntoView({behavior:'smooth',block:'start'});
  }
}

// Handle browser back/forward button
window.addEventListener('popstate', (e) => {
  const target = e.state && e.state.section ? e.state.section : 'home';
  const section = document.getElementById(target);
  if (section) {
    section.scrollIntoView({behavior:'smooth',block:'start'});
  }
});

// On page load, check if URL has a route and scroll to it
function restoreRouteFromURL() {
  const path = window.location.pathname;
  const match = path.match(/\/([a-z-]+)$/);
  if (match) {
    const target = match[1];
    const section = document.getElementById(target);
    if (section) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        section.scrollIntoView({behavior:'auto',block:'start'});
      }, 100);
    }
  }
}

/* Authentication (client-side) */
function handleLogin(e) {
  e.preventDefault();
  const emailEl = document.getElementById('owner-email');
  const pwd = document.getElementById('owner-password').value || '';
  const email = emailEl ? (emailEl.value || '').trim() : '';

  // If an email is provided, try server-side auth. Otherwise, fall back to legacy client-only password.
  if (email) {
    if (!pwd) return alert('Enter password');
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pwd })
        });
        if (!res.ok) {
          if (res.status === 401) return alert('Invalid credentials');
          const body = await res.json().catch(() => ({}));
          return alert('Login failed: ' + (body.error || res.statusText));
        }
        const data = await res.json();
        if (data && data.token) {
          setToken(data.token);
          isOwner = true;
          applyAuthState(true);
          document.getElementById('owner-password').value = '';
          if (emailEl) emailEl.value = '';
          renderOwnerLinksList();
        } else {
          alert('Login response did not include a token');
        }
      } catch (err) {
        console.error('Login error', err);
        alert('Login failed: ' + err.message);
      }
    })();
  } else {
    // legacy local password flow
    if (!pwd) return alert('Enter password');
    getStoredOwnerHash().then(storedHash => {
      hashPassword(pwd).then(h => {
        if (h === storedHash) {
          isOwner = true;
          applyAuthState(true);
          document.getElementById('owner-password').value = '';
          renderOwnerLinksList();
        } else {
          alert('Incorrect password');
        }
      });
    });
  }
}

function handleLogout(e) {
  e && e.preventDefault();
  isOwner = false;
  clearToken();
  applyAuthState(false);
  // Close modal on logout
  closeModal(e);
}

function applyAuthState(isOwner) {
  const ownerPanel = document.getElementById('modal-owner-panel');
  const loginForm = document.getElementById('modal-login');
  
  if (isOwner) {
    ownerPanel.classList.remove('hidden');
    ownerPanel.setAttribute('aria-hidden','false');
    loginForm.classList.add('hidden');
    loginForm.setAttribute('aria-hidden','true');
  } else {
    ownerPanel.classList.add('hidden');
    ownerPanel.setAttribute('aria-hidden','true');
    loginForm.classList.remove('hidden');
    loginForm.setAttribute('aria-hidden','false');
  }
}

/* Password helpers - use SubtleCrypto for SHA-256 */
async function hashPassword(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const arr = Array.from(new Uint8Array(hashBuffer));
  return arr.map(b => b.toString(16).padStart(2,'0')).join('');
}

async function getStoredOwnerHash() {
  const stored = localStorage.getItem(OWNER_HASH_KEY);
  if (stored) return stored;
  // fallback to legacy plain password hashed at runtime
  return await hashPassword(OWNER_PASSWORD);
}

// Token helpers (server auth)
function setToken(t) { try { sessionStorage.setItem('owner_token', t); } catch(e) {} }
function getToken() { try { return sessionStorage.getItem('owner_token'); } catch(e) { return null; } }
function clearToken() { try { sessionStorage.removeItem('owner_token'); } catch(e) {} }
function getAuthHeaders() {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}


async function handleChangePassword(e) {
  e && e.preventDefault();
  if (!isOwner) return alert('You must be logged in to change the password.');
  const current = document.getElementById('current-password').value || '';
  const next = document.getElementById('new-password').value || '';
  const confirm = document.getElementById('confirm-password').value || '';
  if (!current || !next) return alert('Enter current and new password');
  if (next !== confirm) return alert('New passwords do not match');
  const stored = await getStoredOwnerHash();
  const curHash = await hashPassword(current);
  if (curHash !== stored) return alert('Current password incorrect');
  const newHash = await hashPassword(next);
  localStorage.setItem(OWNER_HASH_KEY, newHash);
  // clear inputs
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  alert('Password changed locally. Keep this folder safe.');
}

function openModal(e) {
  e && e.preventDefault();
  const backdrop = document.getElementById('modal-backdrop');
  const content = backdrop.querySelector('.modal-content');
  
  backdrop.classList.remove('hidden');
  backdrop.classList.add('visible');
  backdrop.setAttribute('aria-hidden', 'false');
  
  // Slight delay to trigger the content animation after backdrop is visible
  setTimeout(() => {
    content.classList.add('visible');
  }, 10);
}

function closeModal(e) {
  e && e.preventDefault();
  
  const backdrop = document.getElementById('modal-backdrop');
  const content = backdrop.querySelector('.modal-content');
  
  // Start the fade out animation for content
  content.classList.remove('visible');
  backdrop.classList.remove('visible');
  
  // Wait for animations to finish before hiding completely
  setTimeout(() => {
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
  }, 300);
}

function backdropClick(e) {
  // Only close if clicking directly on the backdrop (not modal content)
  if (e.target && e.target.classList.contains('modal-backdrop')) {
    closeModal(e);
  }
}

/* Link management */
function loadLinks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    window._links = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse stored links', err);
    window._links = [];
  }
}

function saveLinks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window._links || []));
}

/* Video management: store simple objects {id,title,youtubeId,created} */
function loadVideos() {
  const raw = localStorage.getItem(VIDEO_STORAGE_KEY);
  try {
    window._videos = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse stored videos', err);
    window._videos = [];
  }
}

function saveVideos() {
  localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(window._videos || []));
}

function extractYouTubeID(input) {
  if (!input) return '';
  // If it's already an ID (11+ chars, common), return trimmed
  const plain = input.trim();
  const idMatch = plain.match(/^[A-Za-z0-9_-]{6,}$/);
  if (idMatch) return plain;
  // Try URL patterns
  const url = plain.replace('<','').replace('>','');
  const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
  const m = url.match(regex);
  return m ? m[1] : '';
}

function handleAddVideo(e) {
  e.preventDefault();
  if (!isOwner) return alert('You must be logged in as owner to add videos.');
  const title = document.getElementById('video-title').value.trim();
  let url = document.getElementById('video-url').value.trim();
  if (!title || !url) return alert('Provide title and YouTube URL or ID');
  const ytId = extractYouTubeID(url);
  if (!ytId) return alert('Unable to detect YouTube video ID from the input.');

  // If logged in via server, POST to API; otherwise fall back to local behavior
  const token = getToken();
  if (token) {
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/videos', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ title, youtubeUrlOrId: ytId })
        });
        if (!res.ok) {
          if (res.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized - please login again'); }
          const body = await res.json().catch(() => ({}));
          return alert('Failed to add video: ' + (body.error || res.statusText));
        }
        const video = await res.json();
        // server will emit new:video — but also update client immediately
        window._videos = window._videos || [];
        window._videos.unshift(video);
        saveVideos();
        renderVideos();
        e.target.reset();
      } catch (err) {
        console.error('Add video failed', err);
        alert('Failed to add video: ' + err.message);
      }
    })();
  } else {
    const obj = { id: Date.now().toString(36), title, youtubeId: ytId, created: new Date().toISOString() };
    window._videos = window._videos || [];
    window._videos.unshift(obj);
    saveVideos();
    renderVideos();
    e.target.reset();
  }
}

/* PDF management: store simple objects {id,title,url,created} */
function loadPdfs() {
  const raw = localStorage.getItem(PDF_STORAGE_KEY);
  try {
    window._pdfs = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse stored pdfs', err);
    window._pdfs = [];
  }
}

function savePdfs() {
  localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(window._pdfs || []));
}

function handleAddPdf(e) {
  e.preventDefault();
  if (!isOwner) return alert('You must be logged in as owner to add PDFs.');
  const title = document.getElementById('pdf-title').value.trim();
  const fileInput = document.getElementById('pdf-file');
  if (!title) return alert('Provide a title for the PDF');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return alert('Select a PDF file to upload');

  const file = fileInput.files[0];
  if (file.type !== 'application/pdf') return alert('Please upload a valid PDF file');

  // If logged in with server token, use presign+upload flow, otherwise fallback to local IDB
  const token = getToken();
  if (token) {
    (async () => {
      try {
        const base = getApiBase();
        // Request presigned upload URL
        const presignRes = await fetch(base + '/api/pdfs/presign', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size })
        });
        if (!presignRes.ok) {
          if (presignRes.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized - please login again'); }
          const body = await presignRes.json().catch(() => ({}));
          return alert('Failed to get presigned URL: ' + (body.error || presignRes.statusText));
        }
        const { uploadUrl, fileKey } = await presignRes.json();
        // Upload file directly to S3 using the presigned URL
        const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!uploadRes.ok) return alert('Failed to upload PDF to storage');
        // Save metadata through server
        const saveRes = await fetch(base + '/api/pdfs', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ title, fileKey, filename: file.name, contentType: file.type, size: file.size })
        });
        if (!saveRes.ok) {
          const body = await saveRes.json().catch(() => ({}));
          return alert('Failed to register PDF: ' + (body.error || saveRes.statusText));
        }
        const pdf = await saveRes.json();
        window._pdfs = window._pdfs || [];
        window._pdfs.unshift(pdf);
        savePdfs();
        renderPdfs();
        e.target.reset();
      } catch (err) {
        console.error('PDF upload failed', err);
        alert('PDF upload failed: ' + err.message);
      }
    })();
  } else {
    // Save file into IndexedDB and create a manifest entry
    saveFileToIDB(file).then(fileId => {
      const obj = {
        id: Date.now().toString(36),
        title,
        fileId,
        filename: file.name,
        created: new Date().toISOString()
      };

      window._pdfs = window._pdfs || [];
      window._pdfs.unshift(obj);
      savePdfs();
      renderPdfs();
      e.target.reset();
    }).catch(err => {
      console.error('Failed to save file', err);
      alert('Failed to save PDF file locally. See console for details.');
    });
  }
}

function renderPdfs() {
  const container = document.getElementById('pdfs-list');
  if (!container) return;
  container.innerHTML = '';
  const pdfs = (window._pdfs || []).slice();
  if (pdfs.length === 0) {
    container.innerHTML = '<p class="muted">No PDFs uploaded yet. Owner can login to add documents.</p>';
    return;
  }
  // Render and resolve file blobs when needed (support both uploaded files via IDB and external URLs)
  pdfs.forEach(async p => {
    const card = document.createElement('article');
    card.className = 'pdf-card card';

    const left = document.createElement('div'); left.className = 'pdf-meta';
    const icon = document.createElement('div'); icon.className = 'pdf-icon'; icon.innerHTML = '<i class="fas fa-file-pdf"></i>';
    const details = document.createElement('div'); details.className = 'pdf-details';
    const t = document.createElement('div'); t.className = 'title'; t.textContent = p.title;
    const u = document.createElement('div'); u.className = 'pdf-url';
    if (p.url) {
      try { u.textContent = new URL(p.url).hostname; } catch(e) { u.textContent = p.url; }
    } else if (p.filename) {
      u.textContent = p.filename;
    }
    details.appendChild(t); details.appendChild(u);
    left.appendChild(icon); left.appendChild(details);

    const right = document.createElement('div'); right.className = 'pdf-actions';
    const open = document.createElement('a'); open.className = 'btn btn-ghost'; open.target = '_blank'; open.rel='noopener noreferrer';
    open.textContent = 'Open';
    const dl = document.createElement('a'); dl.className = 'btn'; dl.target = '_blank'; dl.rel='noopener noreferrer'; dl.download = p.filename || '';
    dl.textContent = 'Download';

    // If the manifest points to an uploaded file (fileId), fetch blob from IDB
    if (p.fileId) {
      try {
        const record = await getFileFromIDB(p.fileId);
        if (record && record.file) {
          const blob = record.file;
          const objectUrl = URL.createObjectURL(blob);
          open.href = objectUrl;
          dl.href = objectUrl;
        } else {
          open.href = '#'; dl.href = '#';
        }
      } catch (err) {
        console.error('Failed to load PDF from IDB', err);
        open.href = '#'; dl.href = '#';
      }
    } else if (p.url) {
      open.href = p.url; dl.href = p.url;
    }

    right.appendChild(open); right.appendChild(dl);

    if (isOwner) {
      const del = document.createElement('button'); del.className = 'btn btn-ghost'; del.textContent = 'Delete';
      del.addEventListener('click', () => { if (confirm('Delete this PDF?')) { deletePdf(p._id || p.id); } });
      right.appendChild(del);
    }

    card.appendChild(left); card.appendChild(right);
    container.appendChild(card);
  });
}

function deletePdf(id) {
  // If owner + token, call server API
  const token = getToken();
  const item = (window._pdfs || []).find(x => (x._id || x.id) === id);
  if (token && item && (item._id || item.id)) {
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/pdfs/' + encodeURIComponent(id), { method: 'DELETE', headers: getAuthHeaders() });
        if (!res.ok) {
          if (res.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized'); }
          return alert('Failed to delete PDF');
        }
        // remove locally
        if (item.fileId) deleteFileFromIDB(item.fileId).catch(err => console.error('Failed to delete file from IDB', err));
        window._pdfs = (window._pdfs || []).filter(x => (x._id || x.id) !== id);
        savePdfs();
        renderPdfs();
      } catch (err) { console.error(err); alert('Failed to delete PDF: ' + err.message); }
    })();
  } else {
    // local-only deletion
    const localItem = (window._pdfs || []).find(x => x.id === id);
    if (localItem && localItem.fileId) deleteFileFromIDB(localItem.fileId).catch(err => console.error('Failed to delete file from IDB', err));
    window._pdfs = (window._pdfs || []).filter(x => x.id !== id);
    savePdfs();
    renderPdfs();
  }
}

/* IndexedDB helpers for storing PDF files (blobs) */
function openPdfDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDF_FILE_DB, 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PDF_FILE_STORE)) {
        db.createObjectStore(PDF_FILE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

function saveFileToIDB(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openPdfDB();
      const tx = db.transaction(PDF_FILE_STORE, 'readwrite');
      const store = tx.objectStore(PDF_FILE_STORE);
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      const record = { id, file, name: file.name, type: file.type, created: new Date().toISOString() };
      const req = store.add(record);
      req.onsuccess = () => { resolve(id); };
      req.onerror = (e) => { reject(e.target.error); };
    } catch (err) { reject(err); }
  });
}

function getFileFromIDB(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openPdfDB();
      const tx = db.transaction(PDF_FILE_STORE, 'readonly');
      const store = tx.objectStore(PDF_FILE_STORE);
      const req = store.get(id);
      req.onsuccess = (e) => { resolve(e.target.result); };
      req.onerror = (e) => { reject(e.target.error); };
    } catch (err) { reject(err); }
  });
}

function deleteFileFromIDB(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openPdfDB();
      const tx = db.transaction(PDF_FILE_STORE, 'readwrite');
      const store = tx.objectStore(PDF_FILE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => { resolve(); };
      req.onerror = (e) => { reject(e.target.error); };
    } catch (err) { reject(err); }
  });
}

function renderVideos() {
  const container = document.getElementById('videos-list');
  if (!container) return;
  container.innerHTML = '';
  const videos = (window._videos || []).slice();
  if (videos.length === 0) {
    container.innerHTML = '<p class="muted">No videos added yet. Owner can login to add videos.</p>';
    return;
  }

  videos.forEach(v => {
    const card = document.createElement('article');
    card.className = 'video-card';

    const embedWrap = document.createElement('div');
    embedWrap.className = 'video-embed';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${v.youtubeId}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    embedWrap.appendChild(iframe);

    const meta = document.createElement('div');
    meta.className = 'video-meta';
    const t = document.createElement('div'); t.className = 'title'; t.textContent = v.title;
    const actions = document.createElement('div'); actions.className = 'actions';
    const open = document.createElement('a'); open.className = 'btn btn-ghost'; open.target = '_blank'; open.rel='noopener noreferrer';
    open.href = `https://youtu.be/${v.youtubeId}`; open.textContent = 'Open';
    actions.appendChild(open);

    // Owner actions: Pin / Unpin and Delete
    if (isOwner) {
      const isPinned = window._pinnedVideo && window._pinnedVideo.youtubeId === v.youtubeId;
      const pinBtn = document.createElement('button');
      pinBtn.className = 'btn btn-ghost';
      pinBtn.textContent = isPinned ? 'Unpin' : 'Pin';
      pinBtn.addEventListener('click', () => {
        if (isPinned) {
          if (confirm('Unpin this video?')) unpinVideo();
        } else {
          if (confirm('Pin this video to show permanently until you remove it?')) pinVideo(v);
        }
      });
      actions.appendChild(pinBtn);

      const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Delete';
      del.addEventListener('click', () => { if (confirm('Delete this video?')) { deleteVideo(v.id); } });
      actions.appendChild(del);
    }

    meta.appendChild(t); meta.appendChild(actions);

    card.appendChild(embedWrap);
    card.appendChild(meta);
    container.appendChild(card);
  });
}

function deleteVideo(id) {
  const token = getToken();
  const item = (window._videos || []).find(x => (x._id || x.id) === id);
  if (token && item && (item._id || item.id)) {
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/videos/' + encodeURIComponent(id), { method: 'DELETE', headers: getAuthHeaders() });
        if (!res.ok) {
          if (res.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized'); }
          return alert('Failed to delete video');
        }
        window._videos = (window._videos || []).filter(x => (x._id || x.id) !== id);
        saveVideos();
        if (window._pinnedVideo && (window._pinnedVideo._id || window._pinnedVideo.id) === id) {
          unpinVideo();
        }
        renderVideos();
      } catch (err) { console.error(err); alert('Failed to delete video: ' + err.message); }
    })();
  } else {
    window._videos = (window._videos || []).filter(x => x.id !== id);
    saveVideos();
    if (window._pinnedVideo && window._pinnedVideo.id === id) {
      unpinVideo();
    }
    renderVideos();
  }
}

/* Pinned video helpers: persist a single pinned video until owner removes it */
function loadPinnedVideo() {
  try {
    const raw = localStorage.getItem(PINNED_VIDEO_KEY);
    window._pinnedVideo = raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to parse pinned video', err);
    window._pinnedVideo = null;
  }
}

function savePinnedVideo() {
  if (window._pinnedVideo) {
    localStorage.setItem(PINNED_VIDEO_KEY, JSON.stringify(window._pinnedVideo));
  } else {
    localStorage.removeItem(PINNED_VIDEO_KEY);
  }
}

function renderPinnedVideo() {
  const container = document.getElementById('pinned-video-container');
  if (!container) return;
  container.innerHTML = '';
  const p = window._pinnedVideo;
  if (!p) return;

  const card = document.createElement('article');
  card.className = 'pinned-video';

  const embedWrap = document.createElement('div');
  embedWrap.className = 'video-embed';
  const iframe = document.createElement('iframe');
  // autoplay+mute+loop (use playlist param for loop to work)
  iframe.src = `https://www.youtube.com/embed/${p.youtubeId}?rel=0&autoplay=1&mute=1&loop=1&playlist=${p.youtubeId}`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  embedWrap.appendChild(iframe);

  const meta = document.createElement('div');
  meta.className = 'video-meta';
  const t = document.createElement('div'); t.className = 'title'; t.textContent = p.title || '';
  const actions = document.createElement('div'); actions.className = 'actions';
  const open = document.createElement('a'); open.className = 'btn btn-ghost'; open.target = '_blank'; open.rel='noopener noreferrer';
  open.href = `https://youtu.be/${p.youtubeId}`; open.textContent = 'Open';
  actions.appendChild(open);

  if (isOwner) {
    const unpin = document.createElement('button'); unpin.className = 'btn'; unpin.textContent = 'Unpin';
    unpin.addEventListener('click', () => { if (confirm('Unpin this video?')) unpinVideo(); });
    actions.appendChild(unpin);
  }

  meta.appendChild(t); meta.appendChild(actions);
  card.appendChild(embedWrap); card.appendChild(meta);
  container.appendChild(card);
}

function pinVideo(videoObj) {
  const token = getToken();
  const vidId = videoObj._id || videoObj.id;
  if (token && vidId) {
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/videos/' + encodeURIComponent(vidId) + '/pin', { method: 'POST', headers: getAuthHeaders() });
        if (!res.ok) {
          if (res.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized'); }
          return alert('Failed to pin video');
        }
        const v = await res.json();
        window._pinnedVideo = v;
        savePinnedVideo();
        renderPinnedVideo();
        renderVideos();
      } catch (err) { console.error('Failed to pin video', err); alert('Failed to pin video: ' + err.message); }
    })();
  } else {
    window._pinnedVideo = { id: videoObj.id, title: videoObj.title, youtubeId: videoObj.youtubeId, created: new Date().toISOString() };
    savePinnedVideo();
    renderPinnedVideo();
    renderVideos();
  }
}

function unpinVideo() {
  window._pinnedVideo = null;
  savePinnedVideo();
  renderPinnedVideo();
  renderVideos();
}

function handleAddLink(e) {
  e.preventDefault();
  const title = document.getElementById('link-title').value.trim();
  let url = document.getElementById('link-url').value.trim();

  if (!title || !url) { alert('Please provide title and URL'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const token = getToken();
  if (token) {
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/links', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ title, url })
        });
        if (!res.ok) {
          if (res.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized - please login again'); }
          const body = await res.json().catch(() => ({}));
          return alert('Failed to add link: ' + (body.error || res.statusText));
        }
        const link = await res.json();
        // server will emit new:link; add locally anyway
        window._links = window._links || [];
        window._links.unshift(link);
        saveLinks();
        renderLinks();
        e.target.reset();
      } catch (err) {
        console.error('Add link failed', err);
        alert('Failed to add link: ' + err.message);
      }
    })();
  } else {
    const obj = { id: Date.now().toString(36), title, url };
    window._links = window._links || [];
    window._links.unshift(obj);
    saveLinks();
    renderLinks();
    e.target.reset();
  }
}

function renderLinks() {
  const container = document.getElementById('links-list');
  container.innerHTML = '';
  const links = (window._links || []).slice();

  if (links.length === 0) {
    container.innerHTML = '<p class="muted">No links yet. Owner can login to add daily anchors.</p>';
    return;
  }

  links.forEach(link => {
    const el = document.createElement('article');
    el.className = 'link-item card';

    const left = document.createElement('div');
    left.className = 'link-meta';
    const a = document.createElement('a');
    a.className = 'link-title';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = link.title;
    const u = document.createElement('div');
    u.className = 'link-url';
    u.textContent = new URL(link.url).hostname;

    left.appendChild(a);
    left.appendChild(u);

    const right = document.createElement('div');
    right.className = 'link-actions';
    const openBtn = document.createElement('a');
    openBtn.className = 'btn btn-ghost';
    openBtn.href = link.url;
    openBtn.target = '_blank';
    openBtn.textContent = 'Open';
    right.appendChild(openBtn);

    // show only Open (public). Delete handled in owner modal.
    if (isOwner) {
      const del = document.createElement('button');
      del.className = 'btn btn-ghost';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (confirm('Delete this link?')) deleteLink(link.id);
      });
      right.appendChild(del);
    }

    el.appendChild(left);
    el.appendChild(right);
    container.appendChild(el);
  });
}

function renderOwnerLinksList() {
  const holder = document.getElementById('owner-links-list');
  if (!holder) return;
  holder.innerHTML = '';
  const links = (window._links || []).slice();
  if (links.length === 0) {
    holder.innerHTML = '<p class="muted">No links yet.</p>';
    return;
  }
  links.forEach(l => {
    const row = document.createElement('div');
    row.className = 'owner-link-row';
    const left = document.createElement('div');
    left.textContent = l.title;
    const right = document.createElement('div');
    const open = document.createElement('a');
    open.href = l.url; open.target = '_blank'; open.className = 'btn btn-ghost'; open.textContent = 'Open';
    const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Delete';
    del.addEventListener('click', () => { if (confirm('Delete this link?')) { deleteLink(l._id || l.id); renderOwnerLinksList(); } });
    right.appendChild(open); right.appendChild(del);
    row.appendChild(left); row.appendChild(right);
    holder.appendChild(row);
  });
}

function deleteLink(id) {
  const token = getToken();
  const item = (window._links || []).find(x => (x._id || x.id) === id);
  if (token && item && (item._id || item.id)) {
    (async () => {
      try {
        const base = getApiBase();
        const res = await fetch(base + '/api/links/' + encodeURIComponent(id), { method: 'DELETE', headers: getAuthHeaders() });
        if (!res.ok) {
          if (res.status === 401) { clearToken(); applyAuthState(false); return alert('Unauthorized'); }
          return alert('Failed to delete link');
        }
        window._links = (window._links || []).filter(x => (x._id || x.id) !== id);
        saveLinks();
        renderLinks();
      } catch (err) { console.error(err); alert('Failed to delete link: ' + err.message); }
    })();
  } else {
    window._links = (window._links || []).filter(x => x.id !== id);
    saveLinks();
    renderLinks();
  }
}

/* Contact form handling */
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }
});

function handleContactSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = {
    name: form.querySelector('#contact-name').value.trim(),
    email: form.querySelector('#contact-email').value.trim(),
    phone: form.querySelector('#contact-phone').value.trim(),
    message: form.querySelector('#contact-message').value.trim(),
    timestamp: new Date().toISOString()
  };

  // Store in localStorage (you can modify this to send to a server instead)
  const messages = JSON.parse(localStorage.getItem('contact_messages') || '[]');
  messages.unshift(formData);
  localStorage.setItem('contact_messages', JSON.stringify(messages));

  // Show success message
  alert('Thank you for your message! We will get back to you soon.');
  
  // Reset form
  form.reset();
}
