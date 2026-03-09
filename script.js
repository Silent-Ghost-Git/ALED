/*
    Pt4 Revision Dashboard - JavaScript
*/

const DEFAULT_SUBJECTS = [
    { id: 'english', name: 'English', icon: '\uD83D\uDCD8' },
    { id: 'hindi', name: 'Hindi', icon: '\uD83C\uDDEE\uD83C\uDDF3' },
    { id: 'kannada', name: 'Kannada', icon: '\u0C95' },
    { id: 'maths', name: 'Maths', icon: '\uD83D\uDD22' },
    { id: 'science', name: 'Science', icon: '\uD83D\uDD2C' },
    { id: 'sst', name: 'SST', icon: '\uD83C\uDF0D' }
];

const TIMER_URL = 'https://flocus.com/online-flip-clock/';
const MOTIVATION_URL = 'https://chatgpt.com/share/69a710ee-5b14-8000-8f33-b76daeb57578';
const PORTION_PDF_PATH = 'data/portion.pdf';
const STORAGE_KEY = 'currentSubjectId';
const SUBJECT_ORDER_KEY = 'subjectOrder';

const subjectListEl = document.getElementById('subjectList');
const subjectViewEl = document.getElementById('subjectView');
const subjectPanelEl = document.getElementById('subjectPanel');
const currentSubjectTitleEl = document.getElementById('currentSubjectTitle');
const portionContentEl = document.getElementById('portionContent');
const uploadPortionBtn = document.getElementById('uploadPortionBtn');
const portionFileInput = document.getElementById('portionFileInput');
const portionStatusEl = document.getElementById('portionStatus');
const worksheetsListEl = document.getElementById('worksheetsList');
const planEditorEl = document.getElementById('planEditor');
const backBtn = document.getElementById('backBtn');
const subjectsBtn = document.getElementById('subjectsBtn');
const togglePdfBtn = document.getElementById('togglePdfBtn');
const timerBtn = document.getElementById('timerBtn');
const motivationBtn = document.getElementById('motivationBtn');
const savePlanBtn = document.getElementById('savePlanBtn');
const closeSidebarBtn = document.getElementById('closeSidebar');
const pdfSidebarEl = document.getElementById('pdfSidebar');
const resizeHandleEl = document.querySelector('.resize-handle');
const pdfFrameEl = document.getElementById('pdfFrame');
const sidebarOverlayEl = document.getElementById('sidebarOverlay');
const saveStatusEl = document.getElementById('saveStatus');

// Preview sidebar elements
const previewSidebarEl = document.getElementById('previewSidebar');
const previewTitleEl = document.getElementById('previewTitle');
const previewContentEl = document.getElementById('previewContent');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const fullscreenPreviewBtn = document.getElementById('fullscreenPreviewBtn');
const resizeHandlePreviewEl = document.querySelector('.resize-handle-preview');
const DESKTOP_PDF_MIN_WIDTH = 420;
const SIDEBAR_VIEWPORT_MAX_RATIO = 0.5;

let currentSubject = null;
let currentPortionImages = [];
let subjects = loadSubjectsFromStorage();
let selectedSubjectId = null;

async function init() {
    if (!selectedSubjectId && subjects.length) {
        selectedSubjectId = subjects[0].id;
    }
    renderSubjectList();
    setupEventListeners();
    setupSidebarResize();
    setupPreviewResize();
    await restoreState();
    updateBackButton();
}

function saveState() {
    if (currentSubject) {
        localStorage.setItem(STORAGE_KEY, currentSubject.id);
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

async function restoreState() {
    const savedSubjectId = localStorage.getItem(STORAGE_KEY);
    if (!savedSubjectId) return;

    const subject = subjects.find((s) => s.id === savedSubjectId);
    if (!subject) return;

    await openSubject(subject);
}

function renderSubjectList() {
    subjectListEl.innerHTML = '';

    subjects.forEach((subject, index) => {
        const item = document.createElement('div');
        item.className = `subject-item${subject.id === selectedSubjectId ? ' selected' : ''}`;
        item.innerHTML = `
            <span class="subject-icon">${subject.icon}</span>
            <span class="subject-name">${subject.name}</span>
            <div class="subject-item-actions">
                <button class="subject-move-btn" data-dir="-1" data-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">&#9650;</button>
                <button class="subject-move-btn" data-dir="1" data-index="${index}" ${index === subjects.length - 1 ? 'disabled' : ''} aria-label="Move down">&#9660;</button>
            </div>
        `;
        item.addEventListener('click', () => selectSubject(subject.id));
        item.addEventListener('dblclick', () => openSubject(subject));

        item.querySelectorAll('.subject-move-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const dir = Number(button.getAttribute('data-dir'));
                const btnIndex = Number(button.getAttribute('data-index'));
                const nextIndex = moveSubject(btnIndex, dir);
                if (nextIndex !== null) {
                    selectSubject(subjects[nextIndex].id);
                }
            });
        });

        subjectListEl.appendChild(item);
    });
}

function selectSubject(subjectId) {
    selectedSubjectId = subjectId;
    renderSubjectList();
}

function moveSubject(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= subjects.length) return null;

    const next = [...subjects];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    subjects = next;
    saveSubjectOrder();
    renderSubjectList();
    return targetIndex;
}

function saveSubjectOrder() {
    const order = subjects.map((subject) => subject.id);
    localStorage.setItem(SUBJECT_ORDER_KEY, JSON.stringify(order));
}

function loadSubjectsFromStorage() {
    const raw = localStorage.getItem(SUBJECT_ORDER_KEY);
    if (!raw) return [...DEFAULT_SUBJECTS];

    try {
        const order = JSON.parse(raw);
        if (!Array.isArray(order)) return [...DEFAULT_SUBJECTS];

        const map = new Map(DEFAULT_SUBJECTS.map((subject) => [subject.id, subject]));
        const ordered = [];

        order.forEach((id) => {
            if (map.has(id)) {
                ordered.push(map.get(id));
                map.delete(id);
            }
        });

        map.forEach((subject) => ordered.push(subject));
        return ordered;
    } catch (error) {
        return [...DEFAULT_SUBJECTS];
    }
}

async function openSubject(subject) {
    currentSubject = subject;
    saveState();
    updateBackButton();

    if (currentSubjectTitleEl) {
        currentSubjectTitleEl.textContent = `${subject.icon} ${subject.name}`;
    }

    await loadPortionImages(subject.id);
    await loadWorksheets(subject.id);
    await loadPlan(subject.id);

    subjectPanelEl.style.display = 'none';
    subjectViewEl.classList.add('active');
    window.scrollTo(0, 0);
}

function closeSubjectView() {
    if (currentSubject) {
        selectedSubjectId = currentSubject.id;
    }
    currentSubject = null;
    saveState();
    updateBackButton();

    subjectViewEl.classList.remove('active');
    subjectPanelEl.style.display = 'block';
    window.scrollTo(0, 0);
}

function updateBackButton() {
    backBtn.style.display = currentSubject ? 'flex' : 'none';
}

async function loadPortionImages(subjectId) {
    portionContentEl.innerHTML = '<p class="no-data">Loading portion screenshots...</p>';
    portionStatusEl.textContent = '';

    try {
        const response = await fetch(`/api/portion-images?subject=${encodeURIComponent(subjectId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        currentPortionImages = await response.json();
        renderPortionImages();
    } catch (error) {
        console.error('Error loading portion images:', error);
        portionContentEl.innerHTML = '<p class="no-data">Error loading screenshots.</p>';
    }
}

function renderPortionImages() {
    if (!currentPortionImages.length) {
        portionContentEl.innerHTML = '<p class="no-data">No screenshots yet. Use Upload Screenshots or paste (Ctrl+V).</p>';
        return;
    }

    portionContentEl.innerHTML = currentPortionImages
        .map((image, index) => `
            <div class="portion-item">
                <img class="portion-image" src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name)}">
                <div class="portion-item-bar">
                    <span class="portion-name">${escapeHtml(image.name)}</span>
                    <div class="portion-order-actions">
                        <button class="order-btn" data-index="${index}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>Up</button>
                        <button class="order-btn" data-index="${index}" data-dir="1" ${index === currentPortionImages.length - 1 ? 'disabled' : ''}>Down</button>
                    </div>
                </div>
            </div>
        `)
        .join('');

    portionContentEl.querySelectorAll('.order-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const index = Number(button.getAttribute('data-index'));
            const dir = Number(button.getAttribute('data-dir'));
            await movePortionImage(index, dir);
        });
    });
}

async function movePortionImage(index, direction) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentPortionImages.length) return;

    const copy = [...currentPortionImages];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    currentPortionImages = copy;
    renderPortionImages();

    await savePortionOrder();
}

async function savePortionOrder() {
    if (!currentSubject) return;

    const order = currentPortionImages.map((img) => img.name);
    const response = await fetch('/api/portion-images/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: currentSubject.id, order })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

async function uploadPortionFiles(fileList) {
    if (!currentSubject) return;
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
        portionStatusEl.textContent = 'No image files selected.';
        return;
    }

    portionStatusEl.textContent = 'Uploading...';

    try {
        for (const file of files) {
            const base64 = await fileToBase64(file);
            const response = await fetch('/api/portion-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: currentSubject.id,
                    filename: file.name,
                    mime_type: file.type,
                    image_base64: base64
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        }

        portionStatusEl.textContent = `Uploaded ${files.length} image(s).`;
        await loadPortionImages(currentSubject.id);
    } catch (error) {
        console.error('Error uploading screenshots:', error);
        portionStatusEl.textContent = 'Upload failed.';
    }
}

async function loadWorksheets(subjectId) {
    worksheetsListEl.innerHTML = '<p class="no-data">Loading worksheets...</p>';

    try {
        const response = await fetch(`/api/worksheets?subject=${encodeURIComponent(subjectId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const worksheets = await response.json();
        if (!worksheets || worksheets.length === 0) {
            worksheetsListEl.innerHTML = '<p class="no-data">No worksheets found in this subject folder.</p>';
            return;
        }

        renderWorksheets(worksheets);
    } catch (error) {
        console.error('Error loading worksheets:', error);
        worksheetsListEl.innerHTML = '<p class="no-data">Error loading worksheets.</p>';
    }
}

function renderWorksheets(worksheets) {
    worksheetsListEl.innerHTML = worksheets
        .map(
            (ws) => `
                <div class="worksheet-item" data-file="${escapeHtml(ws.file)}" data-name="${escapeHtml(ws.name)}">
                    <span class="worksheet-icon">${getWorksheetIcon(ws.type)}</span>
                    <span class="worksheet-name">${escapeHtml(ws.name)}</span>
                    <span class="worksheet-type">${escapeHtml(ws.type)}</span>
                    <button class="preview-btn" data-file="${escapeHtml(ws.file)}" data-name="${escapeHtml(ws.name)}" title="Open">📂</button>
                </div>
            `
        )
        .join('');

    worksheetsListEl.querySelectorAll('.worksheet-item').forEach((el) => {
        const file = el.getAttribute('data-file');
        const name = el.getAttribute('data-name');
        
        el.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-btn')) return;
            if (file) openPreview(file, name);
        });
    });

    worksheetsListEl.querySelectorAll('.preview-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const file = btn.getAttribute('data-file');
            const name = btn.getAttribute('data-name');
            if (file) window.open(file, '_blank');
        });
    });
}

async function loadPlan(subjectId) {
    planEditorEl.value = '';
    saveStatusEl.textContent = '';

    try {
        const response = await fetch(`/api/plan?subject=${encodeURIComponent(subjectId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        planEditorEl.value = data.content || '';
    } catch (error) {
        console.error('Error loading plan:', error);
    }
}

async function savePlan() {
    if (!currentSubject) return;

    try {
        const response = await fetch('/api/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: currentSubject.id,
                content: planEditorEl.value
            })
        });

        const data = await response.json();
        showSaveStatus(data.success ? 'Plan saved.' : 'Could not save plan.', data.success ? 'success' : 'error');
    } catch (error) {
        console.error('Error saving plan:', error);
        showSaveStatus('Could not save plan.', 'error');
    }
}

function showSaveStatus(message, type) {
    saveStatusEl.textContent = message;
    saveStatusEl.className = `save-status ${type}`;
    setTimeout(() => {
        saveStatusEl.textContent = '';
        saveStatusEl.className = 'save-status';
    }, 2500);
}

function openPdfSidebar() {
    clampSidebarWidth();
    pdfFrameEl.src = PORTION_PDF_PATH;
    pdfSidebarEl.classList.add('open');
    updateSidebarOverlay();
    togglePdfBtn.textContent = '📄 Hide Portion';
}

function closePdfSidebar() {
    pdfSidebarEl.classList.remove('open');
    updateSidebarOverlay();
    togglePdfBtn.textContent = '📄 Portion';
}

function togglePdfSidebar() {
    if (pdfSidebarEl.classList.contains('open')) {
        closePdfSidebar();
    } else {
        openPdfSidebar();
    }
}

function openTimer() {
    window.open(TIMER_URL, '_blank');
}

function openMotivation() {
    window.open(MOTIVATION_URL, '_blank');
}

function setupEventListeners() {
    backBtn.addEventListener('click', closeSubjectView);
    subjectsBtn.addEventListener('click', closeSubjectView);
    uploadPortionBtn.addEventListener('click', () => {
        if (!currentSubject) return;
        portionFileInput.click();
    });
    portionFileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        await uploadPortionFiles(files);
        portionFileInput.value = '';
    });
    togglePdfBtn.addEventListener('click', togglePdfSidebar);
    closeSidebarBtn.addEventListener('click', closePdfSidebar);
    sidebarOverlayEl.addEventListener('click', () => {
        closePdfSidebar();
        closePreview();
    });
    
    // Preview sidebar events
    closePreviewBtn.addEventListener('click', closePreview);
    fullscreenPreviewBtn.addEventListener('click', toggleFullscreenPreview);
    
    timerBtn.addEventListener('click', openTimer);
    motivationBtn.addEventListener('click', openMotivation);
    savePlanBtn.addEventListener('click', savePlan);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePdfSidebar();
            closePreview();
        }

        const inSubjectList = !currentSubject && subjectPanelEl.style.display !== 'none';
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        const typing = tag === 'textarea' || tag === 'input';
        if (!inSubjectList || typing) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            const selected = subjects.find((s) => s.id === selectedSubjectId);
            if (selected) {
                openSubject(selected);
            }
            return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!selectedSubjectId && subjects.length) {
                selectSubject(subjects[0].id);
                return;
            }

            const index = subjects.findIndex((s) => s.id === selectedSubjectId);
            if (index === -1) return;
            const dir = e.key === 'ArrowUp' ? -1 : 1;
            const nextIndex = (index + dir + subjects.length) % subjects.length;
            selectSubject(subjects[nextIndex].id);
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            if (!subjects.length) return;

            const index = subjects.findIndex((s) => s.id === selectedSubjectId);
            if (index === -1) return;

            const dir = e.shiftKey ? -1 : 1;
            const nextIndex = moveSubject(index, dir);
            if (nextIndex !== null) {
                selectSubject(subjects[nextIndex].id);
            }
        }
    });

    document.addEventListener('paste', async (event) => {
        if (!currentSubject) return;
        const items = Array.from(event.clipboardData?.items || []);
        const imageFiles = items
            .filter((item) => item.type && item.type.startsWith('image/'))
            .map((item, idx) => item.getAsFile() || new File([], `pasted_${idx + 1}.png`, { type: 'image/png' }))
            .filter((file) => file && file.size > 0);

        if (!imageFiles.length) return;
        event.preventDefault();
        await uploadPortionFiles(imageFiles);
    });
}

function getWorksheetIcon(type) {
    if (type === 'pdf') return '\uD83D\uDCC4';
    if (type === 'doc' || type === 'docx') return '\uD83D\uDCDD';
    return '\uD83D\uDCCE';
}

function getSidebarBounds(minWidth = DESKTOP_PDF_MIN_WIDTH) {
    const viewportWidth = window.innerWidth || 1200;
    const maxWidth = Math.max(
        Math.floor(viewportWidth * SIDEBAR_VIEWPORT_MAX_RATIO),
        Math.min(minWidth, viewportWidth)
    );
    const safeMinWidth = Math.min(minWidth, maxWidth);
    return { minWidth: safeMinWidth, maxWidth };
}

function clampSidebarWidth() {
    const { minWidth, maxWidth } = getSidebarBounds();
    const currentWidth = pdfSidebarEl.getBoundingClientRect().width || 400;
    const clamped = Math.max(minWidth, Math.min(currentWidth, maxWidth));
    pdfSidebarEl.style.width = `${clamped}px`;
}

function clampPreviewSidebarWidth() {
    if (!previewSidebarEl) return;
    const { minWidth, maxWidth } = getSidebarBounds();
    const currentWidth = previewSidebarEl.getBoundingClientRect().width || maxWidth;
    const clamped = Math.max(minWidth, Math.min(currentWidth, maxWidth));
    previewSidebarEl.style.width = `${clamped}px`;
}

function updateSidebarOverlay() {
    const hasOpenSidebar = pdfSidebarEl.classList.contains('open') || previewSidebarEl.classList.contains('open');
    sidebarOverlayEl.classList.toggle('visible', hasOpenSidebar);
}

function setupSidebarResize() {
    if (!resizeHandleEl || !pdfSidebarEl) return;

    let activePointerId = null;
    let startX = 0;
    let startWidth = 0;

    const onPointerDown = (event) => {
        activePointerId = event.pointerId;
        startX = event.clientX;
        startWidth = pdfSidebarEl.getBoundingClientRect().width;
        resizeHandleEl.setPointerCapture(activePointerId);
        document.body.classList.add('is-resizing-sidebar');
        event.preventDefault();
    };

    const onPointerMove = (event) => {
        if (event.pointerId !== activePointerId) return;
        const deltaX = startX - event.clientX;
        const { minWidth, maxWidth } = getSidebarBounds();
        const nextWidth = Math.max(minWidth, Math.min(startWidth + deltaX, maxWidth));
        pdfSidebarEl.style.width = `${nextWidth}px`;
        event.preventDefault();
    };

    const stopResizing = (event) => {
        if (event.pointerId !== activePointerId) return;
        if (resizeHandleEl.hasPointerCapture(activePointerId)) {
            resizeHandleEl.releasePointerCapture(activePointerId);
        }
        activePointerId = null;
        document.body.classList.remove('is-resizing-sidebar');
    };

    resizeHandleEl.addEventListener('pointerdown', onPointerDown);
    resizeHandleEl.addEventListener('pointermove', onPointerMove);
    resizeHandleEl.addEventListener('pointerup', stopResizing);
    resizeHandleEl.addEventListener('pointercancel', stopResizing);
    window.addEventListener('resize', clampSidebarWidth);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',', 2)[1] : result;
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error || new Error('File read failed'));
        reader.readAsDataURL(file);
    });
}

// Preview Functions
function openPreview(filePath, fileName) {
    previewTitleEl.textContent = fileName || 'Preview';
    previewContentEl.innerHTML = '';

    const safePath = String(filePath || '');
    const ext = safePath.split(/[?#]/, 1)[0].split('.').pop().toLowerCase();

    if (ext === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = safePath;
        iframe.title = fileName || 'PDF preview';
        previewContentEl.appendChild(iframe);
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        const image = document.createElement('img');
        image.src = safePath;
        image.className = 'image-preview';
        image.alt = fileName || 'Image preview';
        previewContentEl.appendChild(image);
    } else if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) {
        const video = document.createElement('video');
        video.controls = true;
        video.autoplay = true;
        video.src = safePath;
        previewContentEl.appendChild(video);
    } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.autoplay = true;
        audio.src = safePath;
        previewContentEl.appendChild(audio);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-preview-text';

        const message = document.createElement('p');
        message.textContent = `Cannot preview this file type (.${ext || 'unknown'})`;

        const openBtn = document.createElement('button');
        openBtn.className = 'save-btn';
        openBtn.textContent = 'Open in New Tab';
        openBtn.addEventListener('click', () => window.open(safePath, '_blank'));

        wrapper.appendChild(message);
        wrapper.appendChild(openBtn);
        previewContentEl.appendChild(wrapper);
    }

    clampPreviewSidebarWidth();
    previewSidebarEl.classList.add('open');
    updateSidebarOverlay();
}
function closePreview() {
    previewSidebarEl.classList.remove('open');
    previewSidebarEl.classList.remove('fullscreen');
    previewContentEl.innerHTML = '';
    updateSidebarOverlay();
}

function toggleFullscreenPreview() {
    previewSidebarEl.classList.toggle('fullscreen');
    const isFullscreen = previewSidebarEl.classList.contains('fullscreen');
    fullscreenPreviewBtn.title = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
}

function setupPreviewResize() {
    if (!resizeHandlePreviewEl || !previewSidebarEl) return;
    
    let activePointerId = null;
    let startX = 0;
    let startWidth = 0;
    
    const onPointerDown = (event) => {
        activePointerId = event.pointerId;
        startX = event.clientX;
        startWidth = previewSidebarEl.getBoundingClientRect().width;
        resizeHandlePreviewEl.setPointerCapture(activePointerId);
        document.body.classList.add('is-resizing-sidebar');
        event.preventDefault();
    };
    
    const onPointerMove = (event) => {
        if (event.pointerId !== activePointerId) return;
        const deltaX = startX - event.clientX;
        const { minWidth, maxWidth } = getSidebarBounds();
        const nextWidth = Math.max(minWidth, Math.min(startWidth + deltaX, maxWidth));
        previewSidebarEl.style.width = `${nextWidth}px`;
        event.preventDefault();
    };
    
    const stopResizing = (event) => {
        if (event.pointerId !== activePointerId) return;
        if (resizeHandlePreviewEl.hasPointerCapture(activePointerId)) {
            resizeHandlePreviewEl.releasePointerCapture(activePointerId);
        }
        activePointerId = null;
        document.body.classList.remove('is-resizing-sidebar');
    };
    
    resizeHandlePreviewEl.addEventListener('pointerdown', onPointerDown);
    resizeHandlePreviewEl.addEventListener('pointermove', onPointerMove);
    resizeHandlePreviewEl.addEventListener('pointerup', stopResizing);
    resizeHandlePreviewEl.addEventListener('pointercancel', stopResizing);
    window.addEventListener('resize', clampPreviewSidebarWidth);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

document.addEventListener('DOMContentLoaded', init);


