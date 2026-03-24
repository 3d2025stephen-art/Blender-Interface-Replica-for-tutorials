// script.js - merged interactive scaffold with Tutorial Editor, attachments, preview, mapping, and export (ZIP)
// - Base UI interactions (workspaces, tools, v-toolbar, mode switcher, keyboard shortcuts)
// - Tutorial Editor overlay + save/load tutorials to localStorage
// - Image attachment system with stable filenames up to 999, hover preview (VGA style), mini image editor
// - Export helpers: inline HTML export, external-file export, ZIP export via JSZip (dynamically loaded)
// - Mapping editor modal (paginated) + download & copy-mapping helpers
//
// Storage keys:
//  - tutorials: 'tutorial_ui_items_v1'
//  - images:    'tutorial_ui_images_v1'
//
// NOTE: This is designed to plug into the index.html structure described earlier.

(() => {
  // ---------- Basic DOM helpers ----------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const body = document.body;

  // ---------- Small utility helpers ----------
  const STORAGE_TUTORIALS = 'tutorial_ui_items_v1';
  const STORAGE_IMAGES = 'tutorial_ui_images_v1';
  const MAX_IMAGES = 999;
  const DEFAULT_FOLDER = 'images';
  const DEFAULT_PREFIX = 'tut-img';

  const safeText = el => (el && el.textContent ? el.textContent.trim() : '');

  // ---------- UI: find pieces ----------
  const workspaceTabs = $$('.workspace-tabs .tab');
  const leftTools = $$('.left-toolbar .tool');
  const vBtns = $$('.v-toolbar-left .v-btn');
  const nHeaders = $$('.n-header');
  const submenuHeaders = $$('.submenu-header');
  const propTabs = $$('.properties .panel-tabs .tab-icon');
  const treeItems = $$('.outliner .tree-item');
  const modeSelector = $('.mode-selector');
  const viewportObjectName = $('.viewport-title .object-name');
  const propHeaderName = $('.properties .prop-header span') || null;
  const statusCenter = $('.status-center');

  // add live indicator if missing
  let liveIndicator = statusCenter && statusCenter.querySelector('.live-indicator');
  if (!liveIndicator && statusCenter) {
    liveIndicator = document.createElement('span');
    liveIndicator.className = 'live-indicator';
    liveIndicator.style.marginLeft = '8px';
    liveIndicator.style.color = 'var(--text-primary)';
    liveIndicator.style.fontWeight = '500';
    liveIndicator.style.whiteSpace = 'nowrap';
    statusCenter.appendChild(liveIndicator);
  }

  // ---------- Core UI interactions (from original scaffold) ----------
  // workspace tabs
  workspaceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      workspaceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = safeText(tab) || 'layout';
      body.dataset.workspace = name.toLowerCase().replace(/\s+/g, '-');
      const titleText = $('.title-left .title-text');
      if (titleText) titleText.textContent = `(Unsaved) - ${tab.textContent.trim()} - Blender 4.5.3 LTS`;
    });
  });

  // left toolbar
  leftTools.forEach(tool => {
    tool.addEventListener('click', () => {
      leftTools.forEach(t => t.classList.remove('active'));
      tool.classList.add('active');
      body.dataset.activeTool = (tool.dataset.tool || tool.getAttribute('aria-label') || tool.className || '').toString();
    });
  });

  // viewport toolbar v-btns
  vBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      vBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      body.dataset.viewportTool = btn.querySelector('i')?.getAttribute('data-lucide') || 'unknown';
    });
  });

  // collapsible sections
  function toggleSection(sectionEl) {
    sectionEl.classList.toggle('collapsed');
    const bodyEl = sectionEl.querySelector('.n-body, .submenu-body, .panel-content');
    if (bodyEl) {
      if (sectionEl.classList.contains('collapsed')) bodyEl.style.display = 'none';
      else bodyEl.style.display = '';
    }
  }
  nHeaders.forEach(h => {
    h.addEventListener('click', () => {
      const parent = h.closest('.n-section');
      if (parent) toggleSection(parent);
    });
  });
  submenuHeaders.forEach(h => {
    const parent = h.closest('.submenu-section');
    if (parent) h.addEventListener('click', () => toggleSection(parent));
  });

  // properties tab switching
  propTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      propTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      body.dataset.propTab = i;
    });
  });

  // outliner selection -> update viewport & props
  treeItems.forEach(item => {
    item.addEventListener('click', (ev) => {
      treeItems.forEach(t => t.classList.remove('selected'));
      item.classList.add('selected');
      const nameSpan = item.querySelector('span');
      const name = nameSpan ? nameSpan.textContent.trim() : 'Object';
      if (viewportObjectName) viewportObjectName.textContent = name;
      if (propHeaderName) propHeaderName.textContent = name;
      if (liveIndicator) liveIndicator.textContent = `Selected: ${name}`;
      body.dataset.selectedObject = name;
    });
  });

  // mode switching
  const modes = ['Object Mode', 'Edit Mode', 'Sculpt Mode', 'Vertex Paint', 'Weight Paint'];
  let modeIndex = modes.indexOf(modeSelector?.querySelector('span')?.textContent.trim()) || 1;
  function setMode(index) {
    modeIndex = index < 0 ? 0 : (index % modes.length);
    const modeName = modes[modeIndex];
    if (modeSelector) {
      const span = modeSelector.querySelector('span');
      if (span) span.textContent = modeName;
    }
    body.dataset.mode = modeName.toLowerCase().replace(/\s+/g, '-');
    if (liveIndicator) liveIndicator.textContent = `Mode: ${modeName}`;
  }
  if (modeSelector) {
    modeSelector.addEventListener('click', () => setMode((modeIndex + 1) % modes.length));
  }
  function toggleEditObject() {
    const editIdx = modes.indexOf('Edit Mode');
    const objectIdx = modes.indexOf('Object Mode');
    const next = (modes[modeIndex] === 'Edit Mode') ? objectIdx : editIdx;
    setMode(next);
  }

  // selection type toggles (1/2/3)
  const selectionLabels = $$('.v-label');
  function setSelectionType(idx) {
    selectionLabels.forEach((l, i) => { if (i === idx) l.classList.add('active'); else l.classList.remove('active'); });
    body.dataset.selectionMode = ['vertex','edge','face'][idx] || 'none';
    if (liveIndicator) liveIndicator.textContent = `Selection: ${body.dataset.selectionMode}`;
  }

  // N-panel inputs example binding (location)
  const nInputs = $$('.n-input');
  if (nInputs.length) {
    nInputs.forEach((input) => {
      input.addEventListener('input', () => {
        const parentRow = input.closest('.n-row');
        if (parentRow && parentRow.querySelector('.n-label') && parentRow.querySelector('.n-label').textContent.includes('Location')) {
          const inputs = parentRow.querySelectorAll('.n-input');
          const vals = Array.from(inputs).map(i => i.value);
          if (liveIndicator) liveIndicator.textContent = `Loc: ${vals.join(', ')}`;
          body.dataset.location = vals.join(',');
        }
      });
    });
  }

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement && document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    if (e.key === 'Tab') { e.preventDefault(); toggleEditObject(); return; }
    if (e.key === '1') { setSelectionType(0); return; }
    if (e.key === '2') { setSelectionType(1); return; }
    if (e.key === '3') { setSelectionType(2); return; }

    if (['g','r','s'].includes(e.key.toLowerCase())) {
      const map = { g: ['move','move-3d'], r: ['rotate','rotate-cw','rotate-3d'], s: ['maximize','scale'] };
      const candidates = vBtns.concat(leftTools);
      const wanted = map[e.key.toLowerCase()];
      let found = null;
      for (const c of candidates) {
        const i = c.querySelector('i');
        if (!i) continue;
        const d = i.getAttribute('data-lucide') || '';
        if (wanted.some(w => d.includes(w))) { found = c; break; }
      }
      if (found) { found.click(); if (liveIndicator) liveIndicator.textContent = `Tool: ${e.key.toUpperCase()}`; }
    }
  });

  // initial state
  (function init() {
    if (!workspaceTabs.some(t => t.classList.contains('active'))) workspaceTabs[0]?.classList.add('active');
    if (!leftTools.some(t => t.classList.contains('active'))) leftTools[0]?.classList.add('active');
    if (!vBtns.some(t => t.classList.contains('active'))) vBtns[0]?.classList.add('active');
    const modeText = modeSelector?.querySelector('span')?.textContent?.trim();
    const startIdx = modes.indexOf(modeText) >= 0 ? modes.indexOf(modeText) : modes.indexOf('Edit Mode');
    setMode(startIdx >= 0 ? startIdx : 1);
    setSelectionType(0);
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  })();

  // expose base API
  window._uiBridge = {
    setMode, setSelectionType,
    selectOutliner(name) {
      const match = Array.from(document.querySelectorAll('.outliner .tree-item')).find(t => (t.querySelector('span')?.textContent || '').trim() === name);
      if (match) match.click();
    },
    getState() {
      return {
        mode: body.dataset.mode,
        activeTool: body.dataset.activeTool,
        selected: body.dataset.selectedObject,
        selectionMode: body.dataset.selectionMode,
        location: body.dataset.location || ''
      };
    }
  };

  // ---------- Tutorial Editor: storage & UI ----------
  const viewportEditor = $('#viewport-editor');
  const editorArea = $('#editor-area');
  const saveTutorialBtn = $('#save-tutorial');
  const clearEditorBtn = $('#clear-editor');
  const tutorialModeSelect = $('#tutorial-mode');
  const tutorialSearchInput = $('#tutorial-search');
  const tutorialsListEl = $('#tutorials-list');
  const newTutorialBtn = $('#new-tutorial-btn');

  function loadTutorials() {
    try { return JSON.parse(localStorage.getItem(STORAGE_TUTORIALS) || '[]'); } catch (e) { return []; }
  }
  function saveTutorials(arr) { localStorage.setItem(STORAGE_TUTORIALS, JSON.stringify(arr)); }

  function renderTutorialList(filterMode, filterText) {
    if (!tutorialsListEl) return;
    const items = loadTutorials();
    const filtered = items.filter(it => {
      const modeMatch = !filterMode || it.mode === filterMode;
      const textMatch = !filterText || (it.title + ' ' + it.content).toLowerCase().includes(filterText.toLowerCase());
      return modeMatch && textMatch;
    });
    tutorialsListEl.innerHTML = filtered.map(it => `
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
    tutorialsListEl.querySelectorAll('.delete-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const arr = loadTutorials().filter(x => x.id !== id);
        saveTutorials(arr);
        renderTutorialList(currentModeFilter, tutorialSearchInput.value);
      });
    });
    tutorialsListEl.querySelectorAll('.edit-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = loadTutorials().find(x => x.id === id);
        if (!item) return;
        if (editorArea) editorArea.innerHTML = item.content;
        if (tutorialModeSelect) tutorialModeSelect.value = item.mode;
        if (tutorialSearchInput) tutorialSearchInput.value = item.title || '';
        setEditorVisible(true);
        viewportEditor.dataset.editing = id;
      });
    });
  }

  let currentModeFilter = null;
  renderTutorialList(null, '');

  function setEditorVisible(visible) {
    if (!viewportEditor) return;
    viewportEditor.setAttribute('aria-hidden', visible ? 'false' : 'true');
    viewportEditor.contentEditable = visible ? 'true' : 'false';
    if (visible && editorArea) editorArea.focus();
    body.dataset.editor = visible ? 'on' : 'off';
  }

  if (saveTutorialBtn) {
    saveTutorialBtn.addEventListener('click', () => {
      const items = loadTutorials();
      const content = editorArea?.innerHTML || '';
      const title = (tutorialSearchInput?.value || '').trim() || (content ? content.replace(/<[^>]+>/g,'').slice(0,40) : 'Untitled');
      const mode = tutorialModeSelect?.value || 'object-mode';
      const editingId = viewportEditor?.dataset.editing || null;

      if (editingId) {
        const idx = items.findIndex(x => x.id === editingId);
        if (idx >= 0) {
          items[idx].content = content;
          items[idx].title = title;
          items[idx].mode = mode;
        }
        delete viewportEditor.dataset.editing;
      } else {
        items.unshift({ id: 'tut_' + Date.now(), title, content, mode });
      }
      saveTutorials(items);
      renderTutorialList(currentModeFilter, tutorialSearchInput.value);
      const s = $('#editor-status');
      if (s) { s.textContent = 'Saved ✓'; setTimeout(()=>s.textContent='',1200); }
      setEditorVisible(false);
    });
  }
  if (clearEditorBtn) {
    clearEditorBtn.addEventListener('click', () => { if (editorArea) editorArea.innerHTML = ''; delete viewportEditor.dataset.editing; });
  }
  if (newTutorialBtn) {
    newTutorialBtn.addEventListener('click', () => {
      if (editorArea) editorArea.innerHTML = '<h3>New tutorial step</h3><p>Describe step...</p>';
      if (tutorialSearchInput) tutorialSearchInput.value = '';
      if (tutorialModeSelect) tutorialModeSelect.value = 'object-mode';
      setEditorVisible(true);
    });
  }
  if (tutorialSearchInput) {
    tutorialSearchInput.addEventListener('input', () => renderTutorialList(currentModeFilter, tutorialSearchInput.value));
  }

  // ---------- N-panel view fields (Focal/Clip/Local Camera) ----------
  const focalInput = $('#focal-input');
  const clipStart = $('#clip-start');
  const clipEnd = $('#clip-end');
  const localCamera = $('#local-camera');
  const resetBtn = $('#reset-view');

  function updateViewState() {
    body.dataset.focal = focalInput?.value || '';
    body.dataset.clipStart = clipStart?.value || '';
    body.dataset.clipEnd = clipEnd?.value || '';
    body.dataset.localCamera = localCamera?.checked ? '1' : '0';
    if (liveIndicator) liveIndicator.textContent = `Focal ${body.dataset.focal} | Clip ${body.dataset.clipStart}-${body.dataset.clipEnd}`;
  }
  [focalInput, clipStart, clipEnd].forEach(inp => { if (inp) inp.addEventListener('input', updateViewState); });
  if (localCamera) localCamera.addEventListener('change', updateViewState);
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (focalInput) focalInput.value = '50';
    if (clipStart) clipStart.value = '0.1';
    if (clipEnd) clipEnd.value = '1000';
    if (localCamera) localCamera.checked = false;
    updateViewState();
  });
  setTimeout(updateViewState, 10);

  // ---------- Attachment store helpers ----------
  function loadImages() {
    try { return JSON.parse(localStorage.getItem(STORAGE_IMAGES) || '{}'); } catch (e) { return {}; }
  }
  function saveImages(obj) { localStorage.setItem(STORAGE_IMAGES, JSON.stringify(obj)); }

  function getUsedFilenames() {
    const imgs = loadImages();
    return Object.values(imgs).map(x => x.filename).filter(Boolean);
  }

  function reserveNextFilename(ext = 'png', folder = DEFAULT_FOLDER, prefix = DEFAULT_PREFIX) {
    const used = new Set(getUsedFilenames());
    for (let i = 1; i <= MAX_IMAGES; i++) {
      const fname = `${folder}/${prefix}-${String(i).padStart(3,'0')}.${ext}`;
      if (!used.has(fname)) return fname;
    }
    return null;
  }

  function assignFilenameToId(id, filename) {
    const imgs = loadImages();
    if (!imgs[id]) imgs[id] = {};
    imgs[id].filename = filename;
    saveImages(imgs);
  }

  async function downscaleDataUrl(dataUrl, maxWidth = 1600, maxHeight = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const ratio = Math.min(1, maxWidth / w, maxHeight / h);
        const cw = Math.round(w * ratio), ch = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        const useJPEG = !dataUrl.startsWith('data:image/png');
        const out = canvas.toDataURL(useJPEG ? 'image/jpeg' : 'image/png', quality);
        resolve(out);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // Attach a dataURL to store with an id and metadata, optionally downscale and assign filename
  async function storeImageData(dataUrl, options = { downscale:true }) {
    const imgs = loadImages();
    const id = 'img_' + Date.now() + '_' + Math.round(Math.random()*9999);
    let finalData = dataUrl;
    try {
      if (options.downscale) finalData = await downscaleDataUrl(dataUrl, 1600, 1200, 0.85);
    } catch (e) {
      finalData = dataUrl;
    }
    // pick extension from dataURL
    const ext = finalData.startsWith('data:image/png') ? 'png' : 'jpg';
    const filename = reserveNextFilename(ext) || `${DEFAULT_FOLDER}/${DEFAULT_PREFIX}-999.${ext}`;
    imgs[id] = { dataUrl: finalData, caption: '', filename };
    saveImages(imgs);
    return { id, filename };
  }

  // ---------- Editor attachment UI: add Attach button & file input ----------
  const toolbar = viewportEditor?.querySelector('.editor-toolbar');
  let attachBtn = toolbar?.querySelector('#attach-image-btn');
  let attachFileInput = toolbar?.querySelector('#attach-image-input');

  if (toolbar && !attachBtn) {
    attachBtn = document.createElement('button');
    attachBtn.id = 'attach-image-btn';
    attachBtn.type = 'button';
    attachBtn.className = 'n-btn';
    attachBtn.textContent = 'Attach Image';
    toolbar.insertBefore(attachBtn, toolbar.firstChild);

    attachFileInput = document.createElement('input');
    attachFileInput.type = 'file';
    attachFileInput.accept = 'image/*';
    attachFileInput.id = 'attach-image-input';
    attachFileInput.style.display = 'none';
    toolbar.appendChild(attachFileInput);
  }

  // create preview & editor DOM nodes (floating) if not present
  let preview = document.querySelector('.img-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'img-preview vga';
    preview.innerHTML = '<img/><div class="meta"><div class="caption"></div><div class="ctrls"><button class="open-edit">Edit</button></div></div>';
    document.body.appendChild(preview);
  }
  const previewImg = preview.querySelector('img');
  const previewCaption = preview.querySelector('.caption');
  const previewEditBtn = preview.querySelector('.open-edit');

  let imgEditor = document.querySelector('.img-editor');
  if (!imgEditor) {
    imgEditor = document.createElement('div');
    imgEditor.className = 'img-editor';
    imgEditor.innerHTML = `
      <header><strong>Image Attachment</strong><div><button id="close-img-editor">Close</button></div></header>
      <div class="preview"><img/></div>
      <div class="controls">
        <input type="text" placeholder="Caption" id="img-caption"/>
        <input type="file" id="img-replace" accept="image/*"/>
        <button id="img-save">Save</button>
        <button id="img-remove">Remove</button>
      </div>
    `;
    document.body.appendChild(imgEditor);
  }
  const imgEditorPreview = imgEditor.querySelector('.preview img');
  const imgCaptionIn = imgEditor.querySelector('#img-caption');
  const imgReplaceIn = imgEditor.querySelector('#img-replace');
  const imgSaveBtn = imgEditor.querySelector('#img-save');
  const imgRemoveBtn = imgEditor.querySelector('#img-remove');
  const imgCloseBtn = imgEditor.querySelector('#close-img-editor');

  // helper to wrap selection
  function wrapSelectionWithToken(imgId, suggestedFilename = '') {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!editorArea.contains(range.commonAncestorContainer)) return null;

    const span = document.createElement('span');
    span.className = 'attach-token';
    span.dataset.imgId = imgId;
    if (suggestedFilename) span.dataset.filename = suggestedFilename;
    span.setAttribute('data-attached','1');

    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    // collapse after inserted
    range.collapse(false);
    return span;
  }

  // file input handler -> store image and attach to selected text or insert token
  if (attachFileInput) {
    attachFileInput.addEventListener('change', async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        const stored = await storeImageData(dataUrl, { downscale: true });
        // try wrap selection
        const token = wrapSelectionWithToken(stored.id, stored.filename);
        if (!token && editorArea) {
          const span = document.createElement('span');
          span.className = 'attach-token';
          span.dataset.imgId = stored.id;
          span.dataset.filename = stored.filename;
          span.textContent = '[image]';
          editorArea.appendChild(span);
        }
        attachHoverHandlers();
        ev.target.value = '';
      };
      reader.readAsDataURL(file);
    });
  }
  if (attachBtn) attachBtn.addEventListener('click', () => attachFileInput?.click());

  // ---------- Preview positioning and handlers ----------
  function positionPreviewAtToken(tokenEl) {
    const rect = tokenEl.getBoundingClientRect();
    const previewW = 240, previewH = 160;
    let left = rect.right + 8;
    let top = rect.top - (previewH/4);
    if (left + previewW > window.innerWidth - 8) left = rect.left - previewW - 8;
    if (top + previewH > window.innerHeight - 8) top = window.innerHeight - previewH - 8;
    if (top < 8) top = 8;
    preview.style.left = left + 'px';
    preview.style.top = top + 'px';
  }

  let previewTimeout = null;
  function showPreviewForToken(token) {
    const id = token.dataset.imgId;
    const imgs = loadImages();
    const data = imgs[id];
    if (!data) return;
    previewImg.src = data.dataUrl;
    previewCaption.textContent = data.caption || data.filename || '[no caption]';
    preview.classList.add('show');
    positionPreviewAtToken(token);
    preview.dataset.for = id;
  }
  function hidePreview() { preview.classList.remove('show'); delete preview.dataset.for; }

  function attachHoverHandlers() {
    editorArea?.querySelectorAll('.attach-token').forEach(token => {
      // remove existing to avoid duplicates
      token._enter && token.removeEventListener('mouseenter', token._enter);
      token._leave && token.removeEventListener('mouseleave', token._leave);
      token._click && token.removeEventListener('click', token._click);

      token._enter = () => { if (previewTimeout) clearTimeout(previewTimeout); previewTimeout = setTimeout(()=> showPreviewForToken(token), 200); };
      token._leave = () => { if (previewTimeout) clearTimeout(previewTimeout); setTimeout(()=> { if (!preview.matches(':hover')) hidePreview(); }, 120); };
      token._click = (e) => { e.stopPropagation(); openImageEditorFor(token.dataset.imgId, token); };

      token.addEventListener('mouseenter', token._enter);
      token.addEventListener('mouseleave', token._leave);
      token.addEventListener('click', token._click);
    });
  }
  // attach initially
  attachHoverHandlers();
  // mutation observer to reattach when content changes
  const mo = new MutationObserver(() => attachHoverHandlers());
  if (editorArea) mo.observe(editorArea, { childList: true, subtree: true, characterData: true });

  // preview edit button
  previewEditBtn.addEventListener('click', (e) => {
    const id = preview.dataset.for;
    if (!id) return;
    const token = editorArea.querySelector(`.attach-token[data-img-id="${id}"]`);
    openImageEditorFor(id, token);
  });

  // open mini image editor for a given id/token
  let currentEdit = null; // {id, token}
  function openImageEditorFor(id, tokenEl) {
    const imgs = loadImages();
    const data = imgs[id];
    if (!data) return;
    currentEdit = { id, token: tokenEl };
    imgEditorPreview.src = data.dataUrl;
    imgCaptionIn.value = data.caption || '';
    imgEditor.classList.add('show');
    imgEditor.style.left = Math.max(8, (window.innerWidth - imgEditor.offsetWidth)/2) + 'px';
    imgEditor.style.top = Math.max(40, (window.innerHeight - imgEditor.offsetHeight)/4) + 'px';
  }

  // replace image file in editor
  imgReplaceIn.addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const d = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    imgEditorPreview.src = d;
    imgEditor.dataset.replacedData = d;
  });

  imgSaveBtn.addEventListener('click', () => {
    if (!currentEdit) return;
    const id = currentEdit.id;
    const imgs = loadImages();
    const newCaption = imgCaptionIn.value.trim();
    const replaced = imgEditor.dataset.replacedData;
    if (!imgs[id]) imgs[id] = {};
    if (replaced) imgs[id].dataUrl = replaced;
    imgs[id].caption = newCaption;
    saveImages(imgs);
    if (preview.dataset.for === id) { previewImg.src = imgs[id].dataUrl; previewCaption.textContent = imgs[id].caption || imgs[id].filename || '[no caption]'; }
    delete imgEditor.dataset.replacedData;
    imgEditor.classList.remove('show');
  });

  imgRemoveBtn.addEventListener('click', () => {
    if (!currentEdit) return;
    const id = currentEdit.id;
    const imgs = loadImages();
    delete imgs[id];
    saveImages(imgs);
    const token = currentEdit.token;
    if (token && token.parentNode) {
      const txt = document.createTextNode(token.textContent || '');
      token.parentNode.replaceChild(txt, token);
    }
    currentEdit = null;
    imgEditor.classList.remove('show');
    attachHoverHandlers();
  });

  imgCloseBtn.addEventListener('click', () => { imgEditor.classList.remove('show'); delete imgEditor.dataset.replacedData; });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.img-editor') && !e.target.closest('.attach-token')) imgEditor.classList.remove('show');
    const insideViewport = !!e.target.closest('.viewport');
    if (!insideViewport && viewportEditor?.getAttribute('aria-hidden') === 'false') setEditorVisible(false);
  });

  document.addEventListener('mousemove', (e) => {
    const onToken = !!e.target.closest('.attach-token');
    const onPreview = !!e.target.closest('.img-preview');
    if (!onToken && !onPreview) hidePreview();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewportEditor?.getAttribute('aria-hidden') === 'false') setEditorVisible(false);
  });

  // ---------- Export helpers (single-file HTML & external images) ----------
  function escapeHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function embedImagesInline(html) {
    const imgs = loadImages();
    return html.replace(/<span[^>]*class="attach-token"[^>]*data-img-id="([^"]+)"[^>]*>(.*?)<\/span>/gmi, (m, id, inner) => {
      const data = imgs[id];
      if (!data) return inner;
      const caption = escapeHtml(data.caption || '');
      const dataUrl = data.dataUrl;
      return `<figure class="export-attachment"><img src="${dataUrl}" alt="${caption || 'attachment'}"/><figcaption>${caption}</figcaption></figure>`;
    });
  }
  async function exportSingleHTML(filename = 'tutorials_export.html') {
    const imgs = loadImages();
    const editorHtml = embedImagesInline(editorArea?.innerHTML || '');
    const tutorialsHtml = tutorialsListEl ? embedImagesInline(tutorialsListEl.innerHTML) : '';
    let cssText = '';
    try { const resp = await fetch('style.css'); if (resp.ok) cssText = await resp.text(); } catch (e) {}
    const page = `<!doctype html><html><head><meta charset="utf-8"/><title>Tutorials Export</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${cssText}\nbody{background:#111;color:#eee;padding:20px;font-family:system-ui, sans-serif}</style></head><body><h1>Exported Tutorials</h1><section id="editor-content">${editorHtml}</section><hr/><section id="tutorials-content">${tutorialsHtml}</section></body></html>`;
    const blob = new Blob([page], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // External images export: tokens should have data-filename attributes or storage filename
  function embedImagesByFilename(html) {
    const imgs = loadImages();
    return html.replace(/<span[^>]*class="attach-token"[^>]*data-img-id="([^"]+)"[^>]*>(.*?)<\/span>/gmi, (m, id, inner) => {
      const fileAttr = (m.match(/data-filename="([^"]+)"/i) || [])[1];
      if (fileAttr) return `<figure class="export-attachment"><img src="${fileAttr}" alt="" /><figcaption></figcaption></figure>`;
      if (imgs[id] && imgs[id].filename) return `<figure class="export-attachment"><img src="${imgs[id].filename}" alt="" /><figcaption>${escapeHtml(imgs[id].caption||'')}</figcaption></figure>`;
      // fallback inline
      if (imgs[id] && imgs[id].dataUrl) return `<figure class="export-attachment"><img src="${imgs[id].dataUrl}" alt="${escapeHtml(imgs[id].caption||'')}" /><figcaption>${escapeHtml(imgs[id].caption||'')}</figcaption></figure>`;
      return inner;
    });
  }

  async function exportHTMLWithExternalImages(filename='tutorials_export.html') {
    const editorHtml = embedImagesByFilename(editorArea?.innerHTML || '');
    const tutorialsHtml = tutorialsListEl ? embedImagesByFilename(tutorialsListEl.innerHTML) : '';
    let cssText = '';
    try { const resp = await fetch('style.css'); if (resp.ok) cssText = await resp.text(); } catch (e) {}
    const page = `<!doctype html><html><head><meta charset="utf-8"/><title>Export</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${cssText}</style></head><body><h1>Export</h1><section>${editorHtml}</section><hr/><section>${tutorialsHtml}</section></body></html>`;
    const blob = new Blob([page], {type: 'text/html;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- ZIP export helpers (JSZip dynamic load) ----------
  async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    const url = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = url; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });
      return window.JSZip || null;
    } catch (err) { console.warn('Failed to load JSZip', err); return null; }
  }
  function dataURLToUint8Array(dataURL) {
    const base64 = dataURL.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
    return arr;
  }

  async function exportZipAllAttachments({ folder = DEFAULT_FOLDER, prefix = DEFAULT_PREFIX, includeList = null, zipName = 'tutorial-images.zip' } = {}) {
    const imgs = loadImages();
    const entries = Object.keys(imgs).map(id => ({ id, ...imgs[id] })).filter(x => x.dataUrl);
    if (!entries.length) return alert('No attachments found to export.');

    let filtered = entries;
    if (Array.isArray(includeList)) {
      const set = new Set(includeList);
      filtered = entries.filter(e => e.filename && set.has(e.filename));
    }
    if (!filtered.length) return alert('No matching attachments selected.');

    if (filtered.length <= 20) {
      const useZip = confirm(`You are exporting ${filtered.length} images. Use ZIP archive? (Cancel to download files individually)`);
      if (!useZip) {
        filtered.forEach((e, idx) => {
          const fname = e.filename || `${folder}/${prefix}-${String(idx+1).padStart(3,'0')}.png`;
          const a = document.createElement('a'); a.href = e.dataUrl; a.download = fname.split('/').pop(); document.body.appendChild(a); a.click(); a.remove();
        });
        return;
      }
    }

    const JSZipCtor = await ensureJSZip();
    if (!JSZipCtor) { alert('ZIP export requires JSZip. Please allow loading the dependency or use individual downloads.'); return; }
    const zip = new JSZipCtor();

    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      const filename = (e.filename || `${folder}/${prefix}-${String(i+1).padStart(3,'0')}.png`).split('/').pop();
      try {
        const u8 = dataURLToUint8Array(e.dataUrl);
        zip.file(filename, u8);
      } catch (err) { console.warn('Skipping image', e, err); }
      if (i % 50 === 0) await new Promise(r => setTimeout(r, 50));
    }

    try {
      const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
        const live = document.querySelector('.live-indicator'); if (live) live.textContent = `Zipping: ${Math.round(meta.percent)}%`;
      });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = zipName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { const live = document.querySelector('.live-indicator'); if (live) live.textContent = `ZIP ready (${filtered.length} images)`; }, 400);
    } catch (err) { console.error('ZIP generation failed', err); alert('ZIP generation failed. See console for details.'); }
  }

  // ---------- Mapping editor modal (paginated) ----------
  function createMappingEditorIfNeeded() {
    if (document.getElementById('mapping-editor-modal')) return document.getElementById('mapping-editor-modal');
    const modal = document.createElement('div'); modal.id = 'mapping-editor-modal'; modal.className = 'mapping-modal';
    modal.innerHTML = `
      <div class="mapping-modal-inner">
        <header>
          <h3>Image Mapping Editor</h3>
          <div class="mapping-controls">
            <button id="map-export-zip">Export ZIP</button>
            <button id="map-copy-csv">Copy CSV</button>
            <button id="map-close">Close</button>
          </div>
        </header>
        <div class="mapping-body"><div class="mapping-list" id="mapping-list"></div></div>
        <footer><div class="mapping-pager"><button id="map-prev">Prev</button><span id="map-page-info"></span><button id="map-next">Next</button></div></footer>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderMappingPage(pageIndex = 1, pageSize = 40) {
    const modal = createMappingEditorIfNeeded();
    const listEl = modal.querySelector('#mapping-list');
    const allTokens = Array.from(document.querySelectorAll('.attach-token'));
    const total = allTokens.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const idx = Math.min(Math.max(1, pageIndex), pages);
    const start = (idx - 1) * pageSize;
    const pageTokens = allTokens.slice(start, start + pageSize);

    listEl.innerHTML = pageTokens.map(tok => {
      const id = tok.dataset.imgId || '';
      const imgs = loadImages();
      const existingFile = tok.dataset.filename || (imgs[id] && imgs[id].filename) || '';
      const textPreview = tok.textContent.trim().slice(0, 120).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<div class="mapping-row" data-id="${id}">
        <div class="mapping-token">${textPreview}</div>
        <div class="mapping-filename"><input class="map-fname" value="${existingFile}" placeholder="${DEFAULT_FOLDER}/${DEFAULT_PREFIX}-001.png"/></div>
        <div class="mapping-actions"><button class="map-assign">Assign</button></div>
      </div>`;
    }).join('');

    modal.querySelector('#map-page-info').textContent = `Page ${idx} / ${pages} — ${total} tokens`;

    listEl.querySelectorAll('.map-assign').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.mapping-row');
        const id = row.dataset.id;
        const input = row.querySelector('.map-fname');
        const val = input.value.trim();
        if (!val) return alert('Enter a relative filename (e.g., images/tut-img-001.png)');
        const token = Array.from(document.querySelectorAll('.attach-token')).find(t => t.dataset.imgId === id);
        if (token) token.dataset.filename = val;
        const imgs = loadImages();
        if (!imgs[id]) imgs[id] = {};
        imgs[id].filename = val;
        saveImages(imgs);
        btn.textContent = 'Saved'; setTimeout(()=>btn.textContent='Assign',800);
      });
    });

    modal.querySelector('#map-prev').onclick = () => renderMappingPage(Math.max(1, idx - 1), pageSize);
    modal.querySelector('#map-next').onclick = () => renderMappingPage(Math.min(pages, idx + 1), pageSize);

    modal.querySelector('#map-copy-csv').onclick = async () => {
      const imgs = loadImages();
      const rows = ['filename,id,caption'];
      Object.keys(imgs).forEach(id => {
        if (!imgs[id].filename) return;
        const safe = (imgs[id].caption||'').replace(/"/g,'""');
        rows.push(`${imgs[id].filename},${id},"${safe}"`);
      });
      const csv = rows.join('\n');
      try { await navigator.clipboard.writeText(csv); alert('CSV mapping copied to clipboard.'); }
      catch { prompt('Mapping CSV (copy manually):', csv); }
    };

    modal.querySelector('#map-export-zip').onclick = async () => {
      const imgs = loadImages();
      const includeList = Object.keys(imgs).map(id => imgs[id].filename).filter(Boolean);
      if (!includeList.length) {
        if (!confirm('No filenames assigned. Export all attachments using generated names?')) return;
      }
      await exportZipAllAttachments({ folder: DEFAULT_FOLDER, prefix: DEFAULT_PREFIX, includeList: includeList.length ? includeList : null, zipName: 'tutorial-images.zip' });
    };

    modal.querySelector('#map-close').onclick = () => modal.classList.remove('open');
    modal.classList.add('open');
  }

  // Wire mapping editor to copy-mapping button if present
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#copy-mapping-btn')) {
      createMappingEditorIfNeeded(); renderMappingPage(1, 40);
    }
    if (e.target.closest && e.target.closest('#download-images-btn')) {
      const folder = prompt('Relative folder for suggestions (relative to exported HTML)', DEFAULT_FOLDER) || DEFAULT_FOLDER;
      const prefix = prompt('Filename prefix', DEFAULT_PREFIX) || DEFAULT_PREFIX;
      // download all images individually (small set) or open mapping editor for ZIP
      const imgs = loadImages(); const count = Object.keys(imgs).length;
      if (count === 0) return alert('No attachments found');
      if (count <= 20) {
        // individual downloads
        let idx = 1;
        for (const id of Object.keys(imgs)) {
          const dataUrl = imgs[id].dataUrl;
          const ext = dataUrl && dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
          const filename = `${folder}/${prefix}-${String(idx++).padStart(3,'0')}.${ext}`;
          const a = document.createElement('a'); a.href = dataUrl; a.download = filename.split('/').pop(); document.body.appendChild(a); a.click(); a.remove();
        }
        alert(`Started download of ${count} images. Move files into your tool folder (e.g., ./${folder}/).`);
      } else {
        // open mapping editor for ZIP
        createMappingEditorIfNeeded(); renderMappingPage(1, 40);
      }
    }
    if (e.target.closest && e.target.closest('#export-zip-btn')) {
      exportZipAllAttachments({ folder: DEFAULT_FOLDER, prefix: DEFAULT_PREFIX, includeList: null, zipName: 'tutorial-images.zip' });
    }
  });

  // ---------- small helpers for mapping & validation ----------
  function setFilenamesForTokens({folder = DEFAULT_FOLDER, prefix = DEFAULT_PREFIX, ext = 'png'} = {}) {
    const tokens = Array.from(document.querySelectorAll('.attach-token'));
    const imgs = loadImages();
    let assigned = 0; const warnings = [];
    for (const tok of tokens) {
      if (tok.dataset.filename) continue;
      const id = tok.dataset.imgId;
      if (!id) { warnings.push('token without imgId found'); continue; }
      if (imgs[id] && imgs[id].filename) { tok.dataset.filename = imgs[id].filename; assigned++; continue; }
      const fname = reserveNextFilename(ext, folder, prefix);
      if (!fname) { warnings.push('limit reached (999 images)'); break; }
      tok.dataset.filename = fname;
      if (!imgs[id]) imgs[id] = {};
      imgs[id].filename = fname;
      assigned++;
    }
    saveImages(imgs);
    return { assigned, warnings };
  }

  function validateMapping() {
    const imgs = loadImages();
    const ids = Object.keys(imgs);
    const problems = [];
    if (ids.length > MAX_IMAGES) problems.push(`Too many images: ${ids.length} > ${MAX_IMAGES}`);
    const tokens = Array.from(document.querySelectorAll('.attach-token'));
    for (const tok of tokens) {
      const id = tok.dataset.imgId;
      const fn = tok.dataset.filename || (imgs[id] && imgs[id].filename);
      if (!fn) problems.push(`Token missing filename for id ${id}`);
    }
    return { ok: problems.length === 0, problems, totalImages: ids.length };
  }

  // ---------- expose helpful APIs for debugging & automation ----------
  window._tutorials = {
    add(mode, title, content) { const items = loadTutorials(); items.unshift({ id:'tut_'+Date.now(), mode, title, content }); saveTutorials(items); renderTutorialList(currentModeFilter, tutorialSearchInput.value); },
    list() { return loadTutorials(); }
  };
  window._imageAttach = {
    list: () => loadImages(),
    attachToSelection: () => attachFileInput?.click()
  };
  window._attachmentTools = {
    list: (opts) => Object.keys(loadImages()).map(id => ({ id, ...loadImages()[id] })),
    downloadAll: async ({folder=DEFAULT_FOLDER, prefix=DEFAULT_PREFIX} = {}) => {
      const imgs = loadImages(); let idx = 1;
      for (const id of Object.keys(imgs)) {
        const dataUrl = imgs[id].dataUrl;
        const ext = dataUrl && dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
        const filename = `${folder}/${prefix}-${String(idx++).padStart(3,'0')}.${ext}`;
        const a = document.createElement('a'); a.href = dataUrl; a.download = filename.split('/').pop(); document.body.appendChild(a); a.click(); a.remove();
        await new Promise(r => setTimeout(r, 120));
      }
    },
    copyMapping: async ({folder=DEFAULT_FOLDER, prefix=DEFAULT_PREFIX} = {}) => {
      const imgs = loadImages(); const rows = ['filename,id,caption'];
      Object.keys(imgs).forEach((id,i) => { const fn = imgs[id].filename || `${folder}/${prefix}-${String(i+1).padStart(3,'0')}.png`; const safe = (imgs[id].caption||'').replace(/"/g,'""'); rows.push(`${fn},${id},"${safe}"`); });
      const text = rows.join('\n');
      try { await navigator.clipboard.writeText(text); if (liveIndicator) liveIndicator.textContent = `Mapping copied (${Object.keys(imgs).length})`; alert('Mapping copied to clipboard (CSV)'); }
      catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); alert('Mapping copied (fallback)'); } catch { prompt('Copy mapping:', text); } ta.remove(); }
    }
  };
  window._zipExport = { exportAll: exportZipAllAttachments, reserveNextFilename, MAX_IMAGES };

  // migrate any filename metadata onto tokens on load
  (function migrate_token_filenames() {
    const imgs = loadImages();
    document.querySelectorAll('.attach-token').forEach(t => {
      const id = t.dataset.imgId;
      if (id && imgs[id] && imgs[id].filename) t.dataset.filename = imgs[id].filename;
    });
  })();

})();