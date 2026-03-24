// Interactivity scaffold extended for:
// - foldable File menu
// - focused N-panel View controls (focal, clip start/end, local camera)
// - Tutorial Editor overlay (viewport becomes an editor to create/search tutorials)
// - Tutorials panel: foldable mode sections, save/load tutorial items to localStorage
// - lightweight filtering and UI syncing

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const body = document.body;

  // --- File menu dropdown ---
  const fileMenu = $('#file-menu');
  if (fileMenu) {
    fileMenu.addEventListener('click', (e) => {
      // toggle dropdown when clicking the menu label; ignore clicks on items themselves
      if (e.target.classList.contains('menu-dropdown-item')) return;
      fileMenu.classList.toggle('open');
    });
    // close when clicking a dropdown item (basic actions)
    fileMenu.querySelectorAll('.menu-dropdown-item').forEach(it => {
      it.addEventListener('click', () => {
        const action = it.dataset.action;
        // simple feedback - you can wire these to actual handlers
        const live = document.querySelector('.live-indicator');
        if (live) live.textContent = `File: ${action}`;
        fileMenu.classList.remove('open');
      });
    });
    // close on outside click
    document.addEventListener('click', (e) => {
      if (!fileMenu.contains(e.target)) fileMenu.classList.remove('open');
    });
  }

  // --- N-panel view controls ---
  const focalInput = $('#focal-input');
  const clipStart = $('#clip-start');
  const clipEnd = $('#clip-end');
  const localCamera = $('#local-camera');
  const liveIndicator = document.querySelector('.live-indicator');

  function updateViewState() {
    body.dataset.focal = focalInput?.value || '';
    body.dataset.clipStart = clipStart?.value || '';
    body.dataset.clipEnd = clipEnd?.value || '';
    body.dataset.localCamera = localCamera?.checked ? '1' : '0';
    if (liveIndicator) liveIndicator.textContent = `Focal ${body.dataset.focal} | Clip ${body.dataset.clipStart}-${body.dataset.clipEnd}`;
  }
  [focalInput, clipStart, clipEnd].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', updateViewState);
  });
  if (localCamera) localCamera.addEventListener('change', updateViewState);
  // reset view button
  const resetBtn = $('#reset-view');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (focalInput) focalInput.value = '50';
    if (clipStart) clipStart.value = '0.1';
    if (clipEnd) clipEnd.value = '1000';
    if (localCamera) localCamera.checked = false;
    updateViewState();
  });
  // initialize
  setTimeout(updateViewState, 10);

  // --- Viewport editor toggle ---
  const toggleEditorBtn = $('#toggle-editor');
  const viewportEditor = $('#viewport-editor');
  const editorArea = $('#editor-area');
  const saveBtn = $('#save-tutorial');
  const clearBtn = $('#clear-editor');
  const tutorialModeSelect = $('#tutorial-mode');
  const tutorialSearchInput = $('#tutorial-search');

  function setEditorVisible(visible) {
    if (!viewportEditor) return;
    viewportEditor.setAttribute('aria-hidden', visible ? 'false' : 'true');
    viewportEditor.contentEditable = visible ? 'true' : 'false';
    editorArea.focus();
    body.dataset.editor = visible ? 'on' : 'off';
  }

  if (toggleEditorBtn) {
    toggleEditorBtn.addEventListener('click', () => {
      const visible = viewportEditor.getAttribute('aria-hidden') === 'true';
      setEditorVisible(visible);
    });
  }

  // --- Tutorials storage and UI ---
  const STORAGE_KEY = 'tutorial_ui_items_v1';
  function loadTutorials() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '[]';
      return JSON.parse(raw);
    } catch (e) { return []; }
  }
  function saveTutorials(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function renderTutorialList(filterMode, filterText) {
    const list = $('#tutorials-list');
    if (!list) return;
    const items = loadTutorials();
    const filtered = items.filter(it => {
      const modeMatch = !filterMode || it.mode === filterMode;
      const textMatch = !filterText || (it.title + ' ' + it.content).toLowerCase().includes(filterText.toLowerCase());
      return modeMatch && textMatch;
    });
    list.innerHTML = filtered.map((it, idx) => `
      <div class="tutorial-entry" data-id="${it.id}">
        <div class="entry-meta">
          <div>${it.title || 'Untitled'} <small style="color:var(--text-secondary)">— ${it.mode}</small></div>
          <div>
            <button class="edit-item" data-id="${it.id}">Edit</button>
            <button class="delete-item" data-id="${it.id}">Delete</button>
          </div>
        </div>
        <div class="entry-body">${it.content}</div>
      </div>
    `).join('');
    // attach handlers
    list.querySelectorAll('.delete-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const arr = loadTutorials().filter(x => x.id !== id);
        saveTutorials(arr);
        renderTutorialList(currentModeFilter, tutorialSearchInput.value);
      });
    });
    list.querySelectorAll('.edit-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const item = loadTutorials().find(x => x.id === id);
        if (!item) return;
        // populate editor
        if (editorArea) editorArea.innerHTML = item.content;
        if (tutorialModeSelect) tutorialModeSelect.value = item.mode;
        $('#tutorial-search').value = item.title || '';
        // switch editor on
        setEditorVisible(true);
        // save handler will update existing item if id present in dataset
        viewportEditor.dataset.editing = id;
      });
    });
  }

  // initial render
  let currentModeFilter = null;
  renderTutorialList(null, '');

  // save from editor
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const items = loadTutorials();
      const content = editorArea?.innerHTML || '';
      const title = (tutorialSearchInput?.value || '').trim() || (content ? content.replace(/<[^>]+>/g,'').slice(0,40) : 'Untitled');
      const mode = tutorialModeSelect?.value || 'object-mode';
      const editingId = viewportEditor?.dataset.editing || null;

      if (editingId) {
        // update
        const idx = items.findIndex(x => x.id === editingId);
        if (idx >= 0) {
          items[idx].content = content;
          items[idx].title = title;
          items[idx].mode = mode;
        }
        delete viewportEditor.dataset.editing;
      } else {
        // create
        const entry = {
          id: 'tut_' + Date.now(),
          title,
          content,
          mode
        };
        items.unshift(entry);
      }
      saveTutorials(items);
      renderTutorialList(currentModeFilter, tutorialSearchInput.value);
      // feedback
      const s = $('#editor-status');
      if (s) { s.textContent = 'Saved ���'; setTimeout(()=>s.textContent='',1200); }
      setEditorVisible(false);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (editorArea) editorArea.innerHTML = '';
      delete viewportEditor.dataset.editing;
    });
  }

  // quick new tutorial shortcut
  const newTutorialBtn = $('#new-tutorial-btn');
  if (newTutorialBtn) newTutorialBtn.addEventListener('click', () => {
    if (editorArea) editorArea.innerHTML = '<h3>New tutorial step</h3><p>Describe step...</p>';
    tutorialSearchInput.value = '';
    tutorialModeSelect.value = 'object-mode';
    setEditorVisible(true);
  });

  // modes foldable behavior
  $$('.tutorial-modes .mode-item .mode-header').forEach(h => {
    h.addEventListener('click', () => {
      const parent = h.closest('.mode-item');
      const mode = parent.dataset.mode;
      const isActive = parent.classList.contains('active');
      // collapse all
      $$('.tutorial-modes .mode-item').forEach(mi => mi.classList.remove('active'));
      if (!isActive) {
        parent.classList.add('active');
        currentModeFilter = mode;
      } else {
        currentModeFilter = null;
      }
      renderTutorialList(currentModeFilter, tutorialSearchInput.value);
    });
  });

  // search in editor and tutorials
  if (tutorialSearchInput) {
    tutorialSearchInput.addEventListener('input', (e) => {
      const q = tutorialSearchInput.value.trim();
      renderTutorialList(currentModeFilter, q);
    });
  }

  // clicking a tutorial entry could populate editor (handled in render)
  // expose small API
  window._tutorials = {
    add(mode, title, content) {
      const items = loadTutorials();
      items.unshift({ id:'tut_'+Date.now(), mode, title, content });
      saveTutorials(items);
      renderTutorialList(currentModeFilter, tutorialSearchInput.value);
    },
    list() { return loadTutorials(); }
  };

  // initial icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

  // close editor with ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewportEditor?.getAttribute('aria-hidden') === 'false') {
      setEditorVisible(false);
    }
  });

  // small UX: clicking outside overlay but inside viewport should not close; outside viewport closes editor
  document.addEventListener('click', (e) => {
    const insideViewport = e.target.closest('.viewport');
    if (!insideViewport && viewportEditor?.getAttribute('aria-hidden') === 'false') {
      setEditorVisible(false);
    }
  });

  // expose state for debugging / external sync
  window._uiTutorialState = {
    getModeFilter: () => currentModeFilter,
    setModeFilter(m) { currentModeFilter = m; renderTutorialList(currentModeFilter, tutorialSearchInput.value); },
    showEditor: () => setEditorVisible(true),
    hideEditor: () => setEditorVisible(false)
  };
})();