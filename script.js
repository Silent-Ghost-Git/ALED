/*
  ALED - JavaScript
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

const subjectListEl = document.getElementById('subjectList');
const subjectViewEl = document.getElementById('subjectView');
const subjectPanelEl = document.getElementById('subjectPanel');
const subjectPanelTitleEl = document.getElementById('subjectPanelTitle');
const noExamStateEl = document.getElementById('noExamState');
const currentSubjectTitleEl = document.getElementById('currentSubjectTitle');
const portionContentEl = document.getElementById('portionContent');
const uploadPortionBtn = document.getElementById('uploadPortionBtn');
const portionFileInput = document.getElementById('portionFileInput');
const portionStatusEl = document.getElementById('portionStatus');
const pdfSidebarEl = document.getElementById('pdfSidebar');
const worksheetsListEl = document.getElementById('worksheetsList');
const uploadWorksheetBtn = document.getElementById('uploadWorksheetBtn');
const worksheetFileInput = document.getElementById('worksheetFileInput');
const worksheetStatusEl = document.getElementById('worksheetStatus');
const planEditorEl = document.getElementById('planEditor');
const learningMaterialListEl = document.getElementById('learningMaterialList');
const addLearningMaterialBtn = document.getElementById('addLearningMaterialBtn');
const learningMaterialFileInput = document.getElementById('learningMaterialFileInput');
const backBtn = document.getElementById('backBtn');
const togglePdfBtn = document.getElementById('togglePdfBtn');
const timerBtn = document.getElementById('timerBtn');
const motivationBtn = document.getElementById('motivationBtn');

const savePlanBtn = document.getElementById('savePlanBtn');
const closeSidebarBtn = document.getElementById('closeSidebar');
const resizeHandleEl = document.querySelector('.resize-handle');
const sidebarOverlayEl = document.getElementById('sidebarOverlay');
const saveStatusEl = document.getElementById('saveStatus');
const uploadGlobalPortionBtn = document.getElementById('uploadGlobalPortionBtn');
const globalPortionFileInput = document.getElementById('globalPortionFileInput');
const globalPortionStatusEl = document.getElementById('globalPortionStatus');
const portionSequenceViewerEl = document.getElementById('portionSequenceViewer');

// Preview sidebar elements
const previewSidebarEl = document.getElementById('previewSidebar');
const previewTitleEl = document.getElementById('previewTitle');
const previewContentEl = document.getElementById('previewContent');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const fullscreenPreviewBtn = document.getElementById('fullscreenPreviewBtn');
const resizeHandlePreviewEl = document.querySelector('.resize-handle-preview');

// Timer sidebar elements
const timerSidebarEl = document.getElementById('timerSidebar');
const closeTimerBtn = document.getElementById('closeTimerBtn');
const timerStartBtn = document.getElementById('timerStartBtn');
const timerResetBtn = document.getElementById('timerResetBtn');
const timerDurationInput = document.getElementById('timerDuration');
const timerFullscreenBtn = document.getElementById('timerFullscreenBtn');
const timerControlsEl = document.getElementById('timerControls');
const resizeHandleTimerEl = document.querySelector('.resize-handle-timer');

const DESKTOP_PDF_MIN_WIDTH = 420;
const SIDEBAR_VIEWPORT_MAX_RATIO = 0.5;

const confirmModalEl = document.getElementById('confirmModal');
const confirmMessageEl = document.getElementById('confirmMessage');
const confirmCancelBtn = document.getElementById('confirmCancel');
const confirmOkBtn = document.getElementById('confirmOk');

const renameModalEl = document.getElementById('renameModal');
const renameTitleEl = document.getElementById('renameTitle');
const renameInputEl = document.getElementById('renameInput');
const renameCancelBtn = document.getElementById('renameCancel');
const renameOkBtn = document.getElementById('renameOk');

let pendingRenameCallback = null;

let currentSubject = null;
let currentPortionImages = [];
let currentWorksheets = [];
let currentLearningMaterials = [];
let currentGlobalPortions = [];
let currentTodos = [];
let nextSequenceIndex = 0;
let pendingDeleteCallback = null;
let selectedSubjectId = null;
let subjects = [];
let hasCurrentExam = false;
let currentIndices = {
    portion: 0,
    worksheet: 0,
    learningMaterial: 0,
    plan: 0,
    todo: 0
};

// Timer state
let timerState = {
    isRunning: false,
    isPaused: false,
    totalSeconds: 300, // 5 minutes default
    remainingSeconds: 300,
    startTime: null,
    intervalId: null,
    audioContext: null
};

// Controls fade-out state
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5000; // 5 seconds
let lastActionWasKeyboard = false;

// Digit cache for performance
let digitCache = {
    'hour-tens': null,
    'hour-ones': null,
    'minute-tens': null,
    'minute-ones': null,
    'second-tens': null,
    'second-ones': null
};

function isImageIconValue(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.startsWith('data:image') ||
        trimmed.startsWith('/data/') ||
        trimmed.startsWith('data/') ||
        /^https?:\/\//i.test(trimmed);
}

function isSvgIconValue(value) {
    return typeof value === 'string' && value.trim().startsWith('<svg');
}

function buildSubjectIconMarkup(icon, subjectName, className = 'subject-icon') {
    if (isSvgIconValue(icon)) {
        return `<div class="${className} subject-icon-svg">${icon}</div>`;
    }
    if (isImageIconValue(icon)) {
        return `<div class="${className} subject-icon-image"><img src="${escapeHtml(icon)}" alt="${escapeHtml(subjectName || 'Subject icon')}" style="width:100%;height:100%;object-fit:contain;"></div>`;
    }
    return `<span class="${className}">${escapeHtml(icon || '\u{1F4DA}')}</span>`;
}

async function init() {
    console.log('init called');
    subjects = await loadSubjectsFromServer();
    await loadCurrentExamState();
    if (!selectedSubjectId && subjects.length) {
        selectedSubjectId = subjects[0].id;
    }
    renderSubjectList();
    setupEventListeners();
    setupSidebarResize();
    setupPreviewResize();
    setupTimerResize();
    await restoreState();
    updateBackButton();
}

function saveState() {
    saveStateToServer(currentSubject?.id);
}

async function saveStateToServer(subjectId) {
    try {
        await fetch('/api/state/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentSubject: subjectId })
        });
    } catch (err) {
        console.error('Error saving state:', err);
    }
}

async function restoreState() {
    try {
        const response = await fetch('/api/state');
        const data = await response.json();
        if (!data.currentSubject) return;
        
        const subject = subjects.find((s) => s.id === data.currentSubject);
        if (!subject) return;
        
        await openSubject(subject);
    } catch (err) {
        console.error('Error restoring state:', err);
    }
}

async function loadCurrentExamState() {
    try {
        const response = await fetch('/api/exam/current');
        const data = await response.json();
        hasCurrentExam = Boolean(data.currentExam);
    } catch (err) {
        console.error('Error loading current exam:', err);
        hasCurrentExam = false;
    }

    updateSubjectPanelState();
}

function updateSubjectPanelState() {
    if (!subjectPanelTitleEl || !subjectListEl || !noExamStateEl) return;

    if (hasCurrentExam) {
        subjectPanelTitleEl.style.display = '';
        subjectListEl.style.display = '';
        noExamStateEl.style.display = 'none';
        return;
    }

    subjectPanelTitleEl.style.display = 'none';
    subjectListEl.style.display = 'none';
    noExamStateEl.style.display = 'flex';
}

function renderSubjectList() {
    subjectListEl.innerHTML = '';
    updateSubjectPanelState();

    subjects.forEach((subject, index) => {
        const item = document.createElement('div');
        item.className = `subject-item${subject.id === selectedSubjectId ? ' selected' : ''}`;
        const iconHtml = buildSubjectIconMarkup(subject.icon, subject.name);
        
        item.innerHTML = `
            ${iconHtml}
            <span class="subject-name">${subject.name}</span>
            <div class="subject-item-actions">
                <div class="subject-edit-actions">
                    <button class="subject-rename-btn" data-index="${index}" title="Rename subject">✏️</button>
                    <button class="subject-delete-btn" data-index="${index}" title="Delete subject">🗑️</button>
                </div>
                <div class="subject-move-actions">
                    <button class="subject-move-btn" data-dir="-1" data-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">&#9650;</button>
                    <button class="subject-move-btn" data-dir="1" data-index="${index}" ${index === subjects.length - 1 ? 'disabled' : ''} aria-label="Move down">&#9660;</button>
                </div>
            </div>
        `;
        // Single-click to select, double-click to open subject
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

        // Rename button
        item.querySelectorAll('.subject-rename-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const btnIndex = Number(button.getAttribute('data-index'));
                renameSubject(btnIndex);
            });
        });

        // Delete button
        item.querySelectorAll('.subject-delete-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const btnIndex = Number(button.getAttribute('data-index'));
                deleteSubject(btnIndex);
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

function renameSubject(index) {
    const subject = subjects[index];
    if (!subject) return;

    renameTitleEl.textContent = 'Rename Subject';
    renameInputEl.value = subject.name;
    renameModalEl.classList.add('visible');
    setTimeout(() => renameInputEl.focus(), 10);
    
    pendingRenameCallback = (newName) => {
        if (!newName || !newName.trim()) return;
        subject.name = newName.trim();
        saveSubjectsData();
        renderSubjectList();
    };
}

function deleteSubject(index) {
    const subject = subjects[index];
    if (!subject) return;
    
    confirmMessageEl.textContent = `Delete "${subject.name}"? All data will be lost.`;
    confirmOkBtn.textContent = 'Delete';
    confirmModalEl.classList.add('visible');
    
    pendingDeleteCallback = async () => {
        try {
            await fetch('/api/subjects', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: subject.id, subjectName: subject.name })
            });
        } catch (error) {
            console.error('Failed to delete subject folder:', error);
        }
        
        await refreshSubjects();
        
        if (subject.id === selectedSubjectId && subjects.length > 0) {
            selectSubject(subjects[0].id);
        }
    };
    
    // Focus the Cancel button by default
    setTimeout(() => confirmCancelBtn.focus(), 10);
}

function addSubject() {
    const modal = document.getElementById('addSubjectModal');
    const nameInput = document.getElementById('newSubjectName');
    const iconInput = document.getElementById('newSubjectIcon');
    const iconPreview = document.getElementById('iconPreview');
    const cancelBtn = document.getElementById('cancelAddSubject');
    const confirmBtn = document.getElementById('confirmAddSubject');
    const uploadBtn = document.getElementById('uploadIconBtn');
    const fileInput = document.getElementById('iconFileInput');

    if (!modal || !nameInput || !iconInput || !iconPreview || !cancelBtn || !confirmBtn || !uploadBtn || !fileInput) {
        return;
    }

    const defaultIcon = '\u{1F4DA}';
    let isCleanedUp = false;
    let isSubmitting = false;
    const defaultConfirmLabel = confirmBtn.textContent;
    const normalizeIconText = (value) => String(value || '').trim();
    const normalizeDataImageUrl = (value) => normalizeIconText(value).replace(/\s+/g, '');

    const updatePreview = () => {
        const raw = normalizeIconText(iconInput.value);
        if (!raw) {
            iconPreview.innerHTML = defaultIcon;
            return;
        }

        if (raw.startsWith('data:image')) {
            const src = normalizeDataImageUrl(raw);
            iconPreview.innerHTML = `<img src="${src}" alt="icon" style="width:100%;height:100%;object-fit:contain;">`;
            iconPreview.dataset.iconContent = src;
            iconPreview.dataset.iconType = 'image';
            return;
        }

        if (/^https?:\/\//i.test(raw)) {
            iconPreview.innerHTML = `<img src="${raw}" alt="icon" style="width:100%;height:100%;object-fit:contain;">`;
            iconPreview.dataset.iconContent = raw;
            iconPreview.dataset.iconType = 'image';
            return;
        }

        if (raw.startsWith('<svg')) {
            iconPreview.innerHTML = raw;
            iconPreview.dataset.iconContent = raw;
            iconPreview.dataset.iconType = 'svg';
            return;
        }

        if (raw) {
            iconPreview.innerHTML = raw;
            delete iconPreview.dataset.iconContent;
            delete iconPreview.dataset.iconType;
        } else {
            iconPreview.innerHTML = defaultIcon;
        }
    };

    const handleFileUpload = () => {
        fileInput.click();
    };

    const optimizeIconDataUrl = (dataUrl, maxSize = 64) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            const targetWidth = Math.max(1, Math.round(img.width * scale));
            const targetHeight = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(dataUrl);
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // Use JPEG for fast/small icons; fall back to PNG if unavailable.
            let optimized = canvas.toDataURL('image/jpeg', 0.78);
            if (!optimized.startsWith('data:image/jpeg')) {
                optimized = canvas.toDataURL('image/png');
            }
            resolve(optimized);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });

    const handleFileSelected = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const fileContent = event.target.result;
            if (file.type === 'image/svg+xml') {
                iconPreview.innerHTML = fileContent;
                iconPreview.dataset.iconContent = fileContent;
                iconPreview.dataset.iconType = 'svg';
            } else if (file.type.startsWith('image/')) {
                const optimizedContent = await optimizeIconDataUrl(fileContent);
                iconPreview.innerHTML = `<img src="${optimizedContent}" alt="icon" style="width:100%;height:100%;object-fit:contain;">`;
                iconPreview.dataset.iconContent = optimizedContent;
                iconPreview.dataset.iconType = 'image';
            }
            iconInput.value = '';
        };

        if (file.type === 'image/svg+xml') {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    };

    const ensureSubjectFolder = async (subjectId) => {
        try {
            const createResponse = await fetch('/api/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: subjectId })
            });
            if (createResponse.ok) return true;
        } catch (error) {
            console.warn('Primary subject create endpoint failed, trying fallback:', error);
        }

        // Backward-compatible fallback for older server instances:
        // saving an empty plan will create data/<subject>/plan and parent folders.
        try {
            const fallbackResponse = await fetch('/api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: subjectId, content: '' })
            });
            return fallbackResponse.ok;
        } catch (error) {
            console.error('Fallback subject folder creation failed:', error);
            return false;
        }
    };

    const uploadSubjectIcon = async (subjectId, iconValue) => {
        const normalized = normalizeDataImageUrl(iconValue);
        if (!normalized.startsWith('data:image')) {
            return iconValue;
        }

        const mimeMatch = normalized.match(/^data:([^;]+);base64,/i);
        const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/png';
        const extMap = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'image/svg+xml': '.svg'
        };
        const ext = extMap[mimeType] || '.png';

        const response = await fetch('/api/subject-icon/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: subjectId,
                filename: `icon${ext}`,
                mime_type: mimeType,
                icon_base64: normalized
            })
        });

        if (!response.ok) {
            throw new Error('Icon upload failed');
        }

        const data = await response.json();
        if (!data || !data.url) {
            throw new Error('Icon upload returned no URL');
        }
        return data.url;
    };

    const setSubmittingState = (submitting) => {
        confirmBtn.disabled = submitting;
        confirmBtn.textContent = submitting ? 'Adding...' : defaultConfirmLabel;
    };

    const handleConfirm = async () => {
        if (isSubmitting) return;
        isSubmitting = true;
        setSubmittingState(true);

        const name = nameInput.value.trim();
        const rawIconInput = normalizeIconText(iconInput.value);
        let icon = rawIconInput || defaultIcon;
        if (rawIconInput.startsWith('data:image')) {
            icon = normalizeDataImageUrl(rawIconInput);
        }

        if (iconPreview.dataset.iconContent) {
            const iconType = iconPreview.dataset.iconType;
            const iconContent = iconPreview.dataset.iconContent;
            if (iconType === 'svg' || iconType === 'image') {
                icon = iconContent;
            }
        }

        if (!name) {
            nameInput.focus();
            isSubmitting = false;
            setSubmittingState(false);
            return;
        }

        const baseId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `subject-${Date.now()}`;
        let id = baseId;
        let counter = 2;
        while (subjects.some((s) => s.id === id)) {
            id = `${baseId}-${counter}`;
            counter += 1;
        }

        const created = await ensureSubjectFolder(id);
        if (!created) {
            alert('Could not create subject data folder. Please restart server and try again.');
            isSubmitting = false;
            setSubmittingState(false);
            return;
        }

        if (typeof icon === 'string' && icon.trim().startsWith('data:image')) {
            try {
                icon = await uploadSubjectIcon(id, icon);
            } catch (error) {
                console.error('Failed to upload subject icon:', error);
                alert('Could not save subject icon image to server.');
                isSubmitting = false;
                setSubmittingState(false);
                return;
            }
        }

        subjects.push({ id, name, icon });
        saveSubjectOrder();
        await refreshSubjects();
        selectSubject(id);
        isSubmitting = false;
        setSubmittingState(false);
        cleanup();
    };

    const handleInputEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    };

    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanup();
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === modal) {
            cleanup();
        }
    };

    const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        setSubmittingState(false);
        isSubmitting = false;

        modal.classList.remove('visible');
        iconInput.removeEventListener('input', updatePreview);
        nameInput.removeEventListener('keydown', handleInputEnter);
        iconInput.removeEventListener('keydown', handleInputEnter);
        uploadBtn.removeEventListener('click', handleFileUpload);
        fileInput.removeEventListener('change', handleFileSelected);
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', cleanup);
        modal.removeEventListener('click', handleBackdropClick);
        document.removeEventListener('keydown', handleEscape);
        delete iconPreview.dataset.iconContent;
        delete iconPreview.dataset.iconType;
    };

    nameInput.value = '';
    iconInput.value = '';
    fileInput.value = '';
    iconPreview.innerHTML = defaultIcon;
    iconPreview.dataset.iconContent = '';
    iconPreview.dataset.iconType = '';
    modal.classList.add('visible');
    nameInput.focus();

    iconInput.addEventListener('input', updatePreview);
    nameInput.addEventListener('keydown', handleInputEnter);
    iconInput.addEventListener('keydown', handleInputEnter);
    uploadBtn.addEventListener('click', handleFileUpload);
    fileInput.addEventListener('change', handleFileSelected);
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', cleanup);
    modal.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleEscape);
}
function saveSubjectOrder() {
    saveSubjectsData();
}

async function saveSubjectsData() {
    try {
        await fetch('/api/subjects-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjects: subjects,
                order: subjects.map(s => s.id)
            })
        });
    } catch (err) {
        console.error('Error saving subjects data:', err);
    }
}

function loadSubjectsFromStorage() {
    return [];
}

function loadSubjectsFromStorage() {
    return [];
}

async function loadSubjectsFromServer() {
    try {
        const response = await fetch('/api/subjects');
        const serverSubjects = await response.json();
        
        const savedResponse = await fetch('/api/subjects-data');
        const savedData = await savedResponse.json();
        
        const savedOrder = savedData.order || [];
        const savedSubjects = savedData.subjects || [];
        
        const savedMap = new Map();
        savedSubjects.forEach(s => {
            const key = s.id.toLowerCase();
            savedMap.set(s.id, s);
            savedMap.set(key, s);
        });
        
        const defaults = {
            'English': '📚', 'Maths': '🔢', 'Science': '🔬', 'SST': '🌍',
            'Hindi': '🇮🇳', 'Kannada': '🇮🇳', 'Physics': '⚛️', 'Chemistry': '🧪',
            'Biology': '🧬', 'ComputerScience': '💻', 'Math': '🔢', 'Computer': '💻'
        };
        
        if (!serverSubjects || serverSubjects.length === 0) {
            return savedSubjects;
        }
        
        const map = new Map();
        serverSubjects.forEach(s => {
            const normalizedId = s.id.toLowerCase();
            const saved = savedMap.get(normalizedId) || savedMap.get(s.id);
            const defaultIcon = defaults[s.id] || defaults[normalizedId] || '📖';
            s.icon = s.icon || saved?.icon || defaultIcon;
            map.set(s.id, s);
        });
        
        const ordered = [];
        savedOrder.forEach(id => {
            if (map.has(id)) ordered.push(map.get(id));
        });
        map.forEach(s => {
            if (!ordered.includes(s)) ordered.push(s);
        });
        return ordered;
    } catch (err) {
        console.error('Error loading subjects:', err);
    }
    return [];
}

async function refreshSubjects() {
    subjects = await loadSubjectsFromServer();
    renderSubjectList();
    if (!selectedSubjectId && subjects.length > 0) {
        selectedSubjectId = subjects[0].id;
    }
}

async function openSubject(subject) {
    console.log('Opening subject:', subject.id);
    currentSubject = subject;
    saveState();
    updateBackButton();

    if (currentSubjectTitleEl) {
        const titleIconHtml = buildSubjectIconMarkup(subject.icon, subject.name, 'subject-title-icon');
        currentSubjectTitleEl.innerHTML = `${titleIconHtml}<span class="subject-title-text">${escapeHtml(subject.name)}</span>`;
    }

    await Promise.all([
        loadPortionImages(subject.id),
        loadWorksheets(subject.id),
        loadPlan(subject.id),
        loadLearningMaterials(subject.id),
        loadTodos(subject.id)
    ]);

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
        const url = `/api/portion-images?subject=${encodeURIComponent(subjectId)}`;
        console.log('Fetching portion images from:', url);
        const response = await fetch(url);
        console.log('Response status:', response.status);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        currentPortionImages = await response.json();
        console.log('Portion images loaded:', currentPortionImages);
        renderPortionImages();
    } catch (error) {
        console.error('Error loading portion images:', error);
        portionContentEl.innerHTML = '<p class="no-data">Error loading screenshots.</p>';
    }
}

function renderPortionImages() {
    // Reset portion index when rendering
    currentIndices.portion = 0;
    
    if (!currentPortionImages.length) {
        portionContentEl.innerHTML = '<p class="no-data">No screenshots yet. Use Upload Screenshots or paste (Ctrl+V).</p>';
        return;
    }

    portionContentEl.innerHTML = currentPortionImages
        .map((image, index) => `
            <div class="portion-item" data-index="${index}">
                <img class="portion-image" src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name)}">
                <div class="portion-item-bar">
                    <span class="portion-name">${escapeHtml(image.name)}</span>
                    <div class="portion-order-actions">
                        <button class="order-btn" data-index="${index}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>Up</button>
                        <button class="order-btn" data-index="${index}" data-dir="1" ${index === currentPortionImages.length - 1 ? 'disabled' : ''}>Down</button>
                        <button class="portion-delete-btn" type="button" data-name="${escapeHtml(image.name)}" aria-label="Delete ${escapeHtml(image.name)}" title="Delete image">\u00D7</button>
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

    portionContentEl.querySelectorAll('.portion-delete-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const imageName = button.getAttribute('data-name');
            promptDeletePortionImage(imageName);
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

async function deletePortionImage(name) {
    if (!currentSubject || !name) return;

    try {
        const response = await fetch('/api/portion-images/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: currentSubject.id, filename: name })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        portionStatusEl.textContent = 'Image deleted.';
        await loadPortionImages(currentSubject.id);
    } catch (error) {
        console.error('Error deleting portion image:', error);
        portionStatusEl.textContent = 'Delete failed.';
    }
}

function promptDeletePortionImage(name) {
    if (!name) return;
    confirmMessageEl.textContent = `Delete "${name}"?`;
    confirmOkBtn.textContent = 'Delete';
    confirmModalEl.classList.add('visible');
    pendingDeleteCallback = () => deletePortionImage(name);
    setTimeout(() => confirmCancelBtn.focus(), 10);
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

async function uploadWorksheetFiles(fileList) {
    if (!currentSubject) return;
    const files = Array.from(fileList).filter((file) => file.type);
    if (!files.length) {
        worksheetStatusEl.textContent = 'No files selected.';
        return;
    }

    worksheetStatusEl.textContent = 'Uploading...';

    try {
        for (const file of files) {
            const base64 = await fileToBase64(file);
            const response = await fetch('/api/worksheets/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: currentSubject.id,
                    filename: file.name,
                    file_base64: base64
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        }

        worksheetStatusEl.textContent = `Uploaded ${files.length} file(s).`;
        await loadWorksheets(currentSubject.id);
    } catch (error) {
        console.error('Error uploading worksheets:', error);
        worksheetStatusEl.textContent = 'Upload failed.';
    }
}

async function loadWorksheets(subjectId) {
    worksheetsListEl.innerHTML = '<p class="no-data">Loading worksheets...</p>';

    try {
        const url = `/api/worksheets?subject=${encodeURIComponent(subjectId)}`;
        console.log('Fetching worksheets from:', url);
        const response = await fetch(url);
        console.log('Response status:', response.status);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const worksheets = await response.json();
        console.log('Worksheets loaded:', worksheets);
        currentWorksheets = worksheets;
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
    // Reset worksheet index when rendering
    currentIndices.worksheet = 0;
    
    worksheetsListEl.innerHTML = worksheets
        .map(
            (ws) => `
                <div class="worksheet-item" data-file="${escapeHtml(ws.file)}" data-name="${escapeHtml(ws.name)}" draggable="true">
                    <span class="worksheet-icon">${getWorksheetIcon(ws.type)}</span>
                    <span class="worksheet-name">${escapeHtml(ws.name)}</span>
                    <span class="worksheet-type">${escapeHtml(ws.type)}</span>
                    <button class="preview-btn" data-file="${escapeHtml(ws.file)}" data-name="${escapeHtml(ws.name)}" title="Open">📂</button>
                    <button class="worksheet-delete-btn" data-file="${escapeHtml(ws.file)}" data-name="${escapeHtml(ws.name)}" title="Delete">×</button>
                </div>
            `
        )
        .join('');

    worksheetsListEl.querySelectorAll('.worksheet-item').forEach((el) => {
        const file = el.getAttribute('data-file');
        const name = el.getAttribute('data-name');
        
        el.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-btn') || e.target.classList.contains('worksheet-delete-btn')) return;
            if (file) openPreview(file, name);
        });

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                promptDeleteWorksheet(name, file);
            }
        });
        
        // Drag events for worksheet items
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                name: name,
                file: file
            }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

        worksheetsListEl.querySelectorAll('.preview-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const file = btn.getAttribute('data-file');
                const name = btn.getAttribute('data-name');
                if (file) openPreview(file, name);
            });
        });

    worksheetsListEl.querySelectorAll('.worksheet-delete-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const file = btn.getAttribute('data-file');
            const name = btn.getAttribute('data-name');
            promptDeleteWorksheet(name, file);
        });
    });
}

function showWorksheetStatus(message, type) {
    worksheetStatusEl.textContent = message;
    worksheetStatusEl.className = `save-status ${type}`;
    setTimeout(() => {
        worksheetStatusEl.className = 'save-status';
        setTimeout(() => {
            worksheetStatusEl.textContent = '';
        }, 300);
    }, 2500);
}

function promptDeleteWorksheet(name, file) {
    confirmMessageEl.textContent = `Delete "${name}"?`;
    confirmOkBtn.textContent = 'Delete';
    confirmModalEl.classList.add('visible');
    pendingDeleteCallback = () => deleteWorksheet(name, file);
    // Focus the Cancel button by default
    setTimeout(() => confirmCancelBtn.focus(), 10);
}

async function deleteWorksheet(name, file) {
    if (!currentSubject) return;

    try {
        const response = await fetch('/api/worksheets/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: currentSubject.id, filename: name })
        });

        const data = await response.json();
        if (data.success) {
            showWorksheetStatus('File deleted.', 'success');
            await loadWorksheets(currentSubject.id);
        } else {
            showWorksheetStatus('Delete failed.', 'error');
        }
    } catch (error) {
        console.error('Error deleting worksheet:', error);
        showWorksheetStatus('Delete failed.', 'error');
    }
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

async function loadLearningMaterials(subjectId) {
    if (!learningMaterialListEl) return;
    
    learningMaterialListEl.innerHTML = '<p class="no-data">Loading...</p>';
    
    try {
        const response = await fetch(`/api/learning-materials?subject=${encodeURIComponent(subjectId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        currentLearningMaterials = await response.json();
        renderLearningMaterials();
    } catch (error) {
        console.error('Error loading learning materials:', error);
        learningMaterialListEl.innerHTML = '<p class="no-data">Error loading materials.</p>';
    }
}

function renderLearningMaterials() {
    if (!learningMaterialListEl) return;
    
    if (!currentLearningMaterials.length) {
        learningMaterialListEl.innerHTML = '<p class="no-data">No learning materials yet. Click "+ Add" to upload.</p>';
        return;
    }
    
    learningMaterialListEl.innerHTML = currentLearningMaterials
        .map((item) => {
            const isLink = item.isLink || (item.url && item.url.startsWith('http'));
            const icon = isLink ? '🔗' : getLearningMaterialIcon(item.type);
            const type = isLink ? 'Link' : (item.type || 'File');
            const fileAttr = isLink ? '' : `data-file="${escapeHtml(item.url)}"`;
            
            return `
                <div class="worksheet-item" ${fileAttr} data-name="${escapeHtml(item.name)}">
                    <span class="worksheet-icon">${icon}</span>
                    <span class="worksheet-name">${escapeHtml(item.name)}</span>
                    <span class="worksheet-type">${escapeHtml(type)}</span>
                    <button class="preview-btn" data-file="${escapeHtml(item.url)}" data-name="${escapeHtml(item.name)}" title="Open">📂</button>
                    <button class="worksheet-delete-btn" data-file="${escapeHtml(item.url)}" data-name="${escapeHtml(item.name)}" title="Delete">×</button>
                </div>
            `;
        })
        .join('');
    
    learningMaterialListEl.querySelectorAll('.worksheet-item').forEach((el) => {
        const file = el.getAttribute('data-file');
        const name = el.getAttribute('data-name');
        
        el.setAttribute('tabindex', '0');
        
        el.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-btn') || e.target.classList.contains('worksheet-delete-btn')) return;
            if (file) openPreview(file, name);
        });
        
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (file) {
                    if (file.startsWith('http')) {
                        window.open(file, '_blank');
                    } else {
                        openPreview(file, name);
                    }
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                promptDeleteLearningMaterial(name, file);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                const next = el.nextElementSibling;
                if (next) next.focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = el.previousElementSibling;
                if (prev) prev.focus();
            }
        });
    });
    
    learningMaterialListEl.querySelectorAll('.preview-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const file = btn.getAttribute('data-file');
            const name = btn.getAttribute('data-name');
            if (!file) return;
            // If it's a URL (link), open in new tab
            if (file.startsWith('http')) {
                window.open(file, '_blank');
            } else {
                openPreview(file, name);
            }
        });
    });
    
    learningMaterialListEl.querySelectorAll('.worksheet-delete-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const file = btn.getAttribute('data-file');
            const name = btn.getAttribute('data-name');
            promptDeleteLearningMaterial(name, file);
        });
    });
}

function getLearningMaterialIcon(type) {
    if (!type) return '📄';
    const lowerType = type.toLowerCase();
    if (lowerType.includes('video') || lowerType.includes('mp4') || lowerType.includes('mov')) return '🎬';
    if (lowerType.includes('audio') || lowerType.includes('mp3')) return '🎵';
    if (lowerType.includes('pdf')) return '📕';
    if (lowerType.includes('image') || lowerType.includes('png') || lowerType.includes('jpg')) return '🖼️';
    if (lowerType.includes('text') || lowerType.includes('md') || lowerType.includes('txt')) return '📝';
    return '📄';
}

async function uploadLearningMaterialFiles(fileList) {
    if (!currentSubject) return;
    
    const files = Array.from(fileList);
    if (!files.length) return;
    
    for (const file of files) {
        try {
            const base64 = await fileToBase64(file);
            const response = await fetch('/api/learning-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: currentSubject.id,
                    filename: file.name,
                    mime_type: file.type,
                    file_base64: base64
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            console.error('Error uploading learning material:', error);
        }
    }
    
    await loadLearningMaterials(currentSubject.id);
}

async function uploadLearningMaterialFile(file, customName) {
    if (!currentSubject || !file) {
        console.error('No currentSubject or file:', currentSubject, file);
        return;
    }
    
    try {
        const base64 = await fileToBase64(file);
        const filename = customName || file.name;
        console.log('Uploading:', { subject: currentSubject.id, filename, type: file.type });
        
        const response = await fetch('/api/learning-materials/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: currentSubject.id,
                filename: filename,
                mime_type: file.type,
                file_base64: base64
            })
        });
        
        const result = await response.json();
        console.log('Upload result:', result);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await loadLearningMaterials(currentSubject.id);
    } catch (error) {
        console.error('Error uploading learning material:', error);
    }
}

async function addLearningMaterialLink(url, name) {
    if (!currentSubject) return;
    
    try {
        const response = await fetch('/api/learning-materials/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: currentSubject.id,
                filename: name,
                url: url,
                isLink: true
            })
        });
        
        if (response.ok) {
            await loadLearningMaterials(currentSubject.id);
        }
    } catch (error) {
        console.error('Error adding learning material link:', error);
    }
}

async function deleteLearningMaterial(index) {
    if (!currentSubject || index < 0 || index >= currentLearningMaterials.length) return;
    
    const item = currentLearningMaterials[index];
    
    try {
        const response = await fetch('/api/learning-materials/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: currentSubject.id, filename: item.name })
        });
        
        if (response.ok) {
            await loadLearningMaterials(currentSubject.id);
        }
    } catch (error) {
        console.error('Error deleting learning material:', error);
    }
}

function promptDeleteLearningMaterial(name, file) {
    confirmMessageEl.textContent = `Delete "${name}"?`;
    confirmOkBtn.textContent = 'Delete';
    confirmModalEl.classList.add('visible');
    pendingDeleteCallback = () => {
        deleteLearningMaterialByName(name);
    };
    setTimeout(() => confirmCancelBtn.focus(), 10);
}

async function deleteLearningMaterialByName(name) {
    if (!currentSubject || !name) return;
    
    try {
        const response = await fetch('/api/learning-materials/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: currentSubject.id, filename: name })
        });
        
        if (response.ok) {
            await loadLearningMaterials(currentSubject.id);
        }
    } catch (error) {
        console.error('Error deleting learning material:', error);
    }
}

async function loadTodos(subjectId) {
    const todoListEl = document.getElementById('todoList');
    if (!todoListEl) return;
    
    todoListEl.innerHTML = '<p class="no-data">Loading tasks...</p>';
    
    try {
        const response = await fetch(`/api/todos?subject=${encodeURIComponent(subjectId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        currentTodos = data.todos || [];
        renderTodos();
    } catch (error) {
        console.error('Error loading todos:', error);
        todoListEl.innerHTML = '<p class="no-data">Error loading tasks.</p>';
    }
}

function renderTodos() {
    const todoListEl = document.getElementById('todoList');
    if (!todoListEl) return;
    
    if (currentTodos.length === 0) {
        todoListEl.innerHTML = '<p class="no-data">No tasks yet. Click "Add Task" to get started!</p>';
        return;
    }
    
    todoListEl.innerHTML = currentTodos.map((todo, index) => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}" data-index="${index}">
            <div class="todo-checkbox"></div>
            <div class="todo-text">${formatTodoText(todo.text)}</div>
            <button class="todo-delete" title="Delete task">×</button>
        </div>
    `).join('');
    
    // Add event listeners
    todoListEl.querySelectorAll('.todo-item').forEach(item => {
        const index = parseInt(item.dataset.index);
        
        // Toggle completion on click (but not when clicking file references or delete button)
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('todo-delete') && 
                !e.target.classList.contains('file-reference')) {
                toggleTodo(index);
            }
        });
        
        // Delete button
        const deleteBtn = item.querySelector('.todo-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            promptDeleteTodo(index);
        });
    });
    
    // Add click handlers for file references
    todoListEl.querySelectorAll('.file-reference').forEach(ref => {
        ref.addEventListener('click', (e) => {
            e.stopPropagation();
            const filename = ref.dataset.filename;
            if (filename && currentSubject) {
                // Check if file exists in worksheets
                checkAndOpenFile(filename);
            }
        });
    });
}

async function checkAndOpenFile(filename) {
    if (!currentSubject || !filename) return;
    
    try {
        const response = await fetch(`/api/worksheets?subject=${encodeURIComponent(currentSubject.id)}`);
        if (!response.ok) return;
        
        const worksheets = await response.json();
        const file = worksheets.find(ws => ws.name.toLowerCase().includes(filename.toLowerCase()));
        
        if (file) {
            openPreview(file.file, file.name);
        } else {
            // If not found in worksheets, check if it's a portion image
            const portionResponse = await fetch(`/api/portion-images?subject=${encodeURIComponent(currentSubject.id)}`);
            if (!portionResponse.ok) return;
            
            const portions = await portionResponse.json();
            const portion = portions.find(p => p.name.toLowerCase().includes(filename.toLowerCase()));
            
            if (portion) {
                openPreview(portion.url, portion.name);
            } else {
                alert(`File "${filename}" not found in this subject.`);
            }
        }
    } catch (error) {
        console.error('Error checking file:', error);
    }
}

function formatTodoText(text) {
    // Format @references as clickable spans
    // Check if file exists before making it clickable (we'll do this in renderTodos)
    return text.replace(/@(\w+)/g, (match, filename) => {
        return `<span class="file-reference" data-filename="${filename}">@${filename}</span>`;
    });
}

async function toggleTodo(index) {
    if (index < 0 || index >= currentTodos.length) return;
    
    currentTodos[index].completed = !currentTodos[index].completed;
    await saveTodos();
    renderTodos();
}

function promptDeleteTodo(index) {
    const todo = currentTodos[index];
    if (!todo) return;
    
    confirmMessageEl.textContent = `Delete "${todo.text.substring(0, 30)}${todo.text.length > 30 ? '...' : ''}"?`;
    confirmOkBtn.textContent = 'Delete';
    confirmOkBtn.classList.add('danger');
    confirmOkBtn.classList.remove('complete');
    confirmModalEl.classList.add('visible');
    pendingDeleteCallback = () => deleteTodo(index);
    // Focus the Cancel button by default
    setTimeout(() => confirmCancelBtn.focus(), 10);
}

async function deleteTodo(index) {
    if (index < 0 || index >= currentTodos.length) return;
    
    currentTodos.splice(index, 1);
    await saveTodos();
    renderTodos();
}

async function addTodo(text) {
    if (!text.trim()) return;
    
    currentTodos.push({
        text: text.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    });
    
    await saveTodos();
    renderTodos();
}

async function saveTodos() {
    if (!currentSubject) return;
    
    try {
        await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: currentSubject.id,
                todos: currentTodos
            })
        });
    } catch (error) {
        console.error('Error saving todos:', error);
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

async function loadGlobalPortions() {
    portionSequenceViewerEl.innerHTML = '<p class="no-data">Loading portions...</p>';
    globalPortionStatusEl.textContent = '';

    try {
        const response = await fetch('/api/portions');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        currentGlobalPortions = await response.json();
        renderGlobalPortions();
    } catch (error) {
        console.error('Error loading portions:', error);
        portionSequenceViewerEl.innerHTML = '<p class="no-data">Error loading portions.</p>';
    }
}

function renderGlobalPortions() {
    if (!currentGlobalPortions.length) {
        portionSequenceViewerEl.innerHTML = '<p class="no-data">Upload files to start reading.</p>';
        nextSequenceIndex = 0;
        return;
    }

    renderPortionSequence(0);
}

function createInlineViewerElement(filePath, fileName) {
    const safePath = String(filePath || '');
    const ext = getFileExtension(safePath);

    if (ext === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = `${safePath}#toolbar=1&navpanes=1&scrollbar=1&zoom=page-width&view=FitH`;
        iframe.title = fileName || 'PDF preview';
        iframe.className = 'portion-sequence-embed';
        return iframe;
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        const image = document.createElement('img');
        image.src = safePath;
        image.className = 'portion-sequence-image';
        image.alt = fileName || 'Image preview';
        return image;
    }

    if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) {
        const video = document.createElement('video');
        video.controls = true;
        video.src = safePath;
        video.className = 'portion-sequence-media';
        return video;
    }

    if (['mp3', 'wav', 'flac', 'm4a'].includes(ext)) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = safePath;
        audio.className = 'portion-sequence-media';
        return audio;
    }

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
    return wrapper;
}

function renderPortionSequence(startIndex) {
    portionSequenceViewerEl.innerHTML = '';

    if (!currentGlobalPortions.length) {
        portionSequenceViewerEl.innerHTML = '<p class="no-data">No portion files.</p>';
        nextSequenceIndex = 0;
        return;
    }

    const safeStart = Math.max(0, Math.min(startIndex, currentGlobalPortions.length - 1));
    nextSequenceIndex = safeStart;
    portionSequenceViewerEl.scrollTop = 0;
    appendNextPortionToSequence();
    maybeAppendNextPortion();
}

function appendNextPortionToSequence() {
    if (nextSequenceIndex >= currentGlobalPortions.length) return false;

    const currentIndex = nextSequenceIndex;
    const portion = currentGlobalPortions[currentIndex];
    nextSequenceIndex += 1;

    const section = document.createElement('section');
    section.className = 'portion-sequence-item';

    const header = document.createElement('div');
    header.className = 'portion-sequence-header';

    const title = document.createElement('h4');
    title.className = 'portion-sequence-title';
    title.textContent = portion.name;

    const actions = document.createElement('div');
    actions.className = 'portion-sequence-actions';

    const typeEl = document.createElement('span');
    typeEl.className = 'portion-sequence-type';
    typeEl.textContent = String(portion.type || '').toUpperCase();

    const upBtn = document.createElement('button');
    upBtn.className = 'order-btn';
    upBtn.textContent = 'Up';
    upBtn.disabled = currentIndex === 0;
    upBtn.addEventListener('click', async () => {
        await moveGlobalPortion(currentIndex, -1);
    });

    const downBtn = document.createElement('button');
    downBtn.className = 'order-btn';
    downBtn.textContent = 'Down';
    downBtn.disabled = currentIndex === currentGlobalPortions.length - 1;
    downBtn.addEventListener('click', async () => {
        await moveGlobalPortion(currentIndex, 1);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'portion-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', () => {
        promptDeleteGlobalPortion(portion.name);
    });

    actions.appendChild(typeEl);
    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(title);
    header.appendChild(actions);

    section.appendChild(header);
    section.appendChild(createInlineViewerElement(portion.url, portion.name));
    portionSequenceViewerEl.appendChild(section);
    return true;
}

function maybeAppendNextPortion() {
    if (!portionSequenceViewerEl) return;

    const threshold = 160;
    if (
        nextSequenceIndex < currentGlobalPortions.length
        && (portionSequenceViewerEl.scrollHeight - portionSequenceViewerEl.clientHeight - portionSequenceViewerEl.scrollTop) <= threshold
    ) {
        appendNextPortionToSequence();
    }
}

async function saveGlobalPortionsOrder() {
    const order = currentGlobalPortions.map((item) => item.name);
    const response = await fetch('/api/portions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

async function moveGlobalPortion(index, direction) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentGlobalPortions.length) return;

    const copy = [...currentGlobalPortions];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    currentGlobalPortions = copy;
    renderGlobalPortions();

    try {
        await saveGlobalPortionsOrder();
        globalPortionStatusEl.textContent = 'Order saved.';
    } catch (error) {
        console.error('Error saving portions order:', error);
        globalPortionStatusEl.textContent = 'Could not save order.';
    }
}

async function uploadGlobalPortionFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.size > 0);
    if (!files.length) {
        globalPortionStatusEl.textContent = 'No files selected.';
        return;
    }

    globalPortionStatusEl.textContent = 'Uploading...';
    try {
        for (const file of files) {
            const base64 = await fileToBase64(file);
            const response = await fetch('/api/portions/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    file_base64: base64
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        }

        globalPortionStatusEl.textContent = `Uploaded ${files.length} file(s).`;
        await loadGlobalPortions();
    } catch (error) {
        console.error('Error uploading portions:', error);
        globalPortionStatusEl.textContent = 'Upload failed.';
    }
}

async function deleteGlobalPortion(name) {
    if (!name) return;

    try {
        const response = await fetch('/api/portions/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: name })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        globalPortionStatusEl.textContent = 'File deleted.';
        await loadGlobalPortions();
    } catch (error) {
        console.error('Error deleting portion:', error);
        globalPortionStatusEl.textContent = 'Delete failed.';
    }
}

function promptDeleteGlobalPortion(name) {
    if (!name) return;
    confirmMessageEl.textContent = `Delete "${name}"?`;
    confirmOkBtn.textContent = 'Delete';
    confirmModalEl.classList.add('visible');
    pendingDeleteCallback = () => deleteGlobalPortion(name);
    // Focus the Cancel button by default
    setTimeout(() => confirmCancelBtn.focus(), 10);
}

async function openPdfSidebar() {
    clampSidebarWidth();
    pdfSidebarEl.classList.add('open');
    updateSidebarOverlay();
    togglePdfBtn.textContent = '📄 Hide Portion';
    await loadGlobalPortions();
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
        void openPdfSidebar();
    }
}

// Controls fade-out functions
function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    showTimerControls();
    inactivityTimer = setTimeout(hideTimerControls, INACTIVITY_TIMEOUT);
}

function hideTimerControls() {
    if (timerControlsEl && timerState.isRunning) {
        timerControlsEl.classList.add('hidden');
    }
}

function showTimerControls() {
    if (timerControlsEl) {
        timerControlsEl.classList.remove('hidden');
    }
}

// Timer functions
function openTimerSidebar() {
    clampTimerSidebarWidth();
    timerSidebarEl.classList.add('open');
    updateSidebarOverlay();
    
    // Try to restore timer state from localStorage
    const restored = restoreTimerState();
    if (!restored) {
        loadTimerDuration();
    }
    
    // Always update display
    updateTimerDisplay();
    
    // If timer is running, restore button state and restart interval
    if (timerState.isRunning) {
        timerStartBtn.textContent = timerState.isPaused ? 'Resume' : 'Pause';
        timerStartBtn.classList.toggle('paused', timerState.isPaused);
        timerResetBtn.style.display = 'inline-block';
        
        // Restart interval if not paused
        if (!timerState.isPaused) {
            if (timerState.intervalId) clearInterval(timerState.intervalId);
            timerState.intervalId = setInterval(updateTimer, 500);
        }
    } else {
        timerResetBtn.style.display = 'none';
    }
    
    startInactivityTimer();
}

function closeTimerSidebar() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    timerSidebarEl.classList.remove('open');
    timerSidebarEl.classList.remove('fullscreen');
    document.body.style.overflow = '';
    updateSidebarOverlay();
}

function toggleTimerSidebar() {
    if (timerSidebarEl.classList.contains('open')) {
        closeTimerSidebar();
    } else {
        openTimerSidebar();
    }
}

function loadTimerDuration() {
    const savedDuration = localStorage.getItem('timerDuration');
    if (savedDuration) {
        const duration = parseFloat(savedDuration);
        if (duration >= 0.1 && duration <= 1440) {
            timerDurationInput.value = duration;
            timerState.totalSeconds = Math.round(duration * 60);
            timerState.remainingSeconds = Math.round(duration * 60);
        }
    }
}

function saveTimerDuration() {
    const duration = parseFloat(timerDurationInput.value);
    if (duration >= 0.1 && duration <= 1440) {
        localStorage.setItem('timerDuration', duration);
    }
}

function saveTimerState() {
    if (timerState.isRunning) {
        const endTime = timerState.startTime + (timerState.totalSeconds * 1000);
        localStorage.setItem('timerEndTime', endTime.toString());
        localStorage.setItem('timerIsRunning', 'true');
        localStorage.setItem('timerIsPaused', timerState.isPaused.toString());
        localStorage.setItem('timerTotalSeconds', timerState.totalSeconds.toString());
    } else {
        localStorage.removeItem('timerEndTime');
        localStorage.removeItem('timerIsRunning');
        localStorage.removeItem('timerIsPaused');
        localStorage.removeItem('timerTotalSeconds');
    }
}

function restoreTimerState() {
    const savedEndTime = localStorage.getItem('timerEndTime');
    const isRunning = localStorage.getItem('timerIsRunning') === 'true';
    const isPaused = localStorage.getItem('timerIsPaused') === 'true';
    const totalSeconds = parseInt(localStorage.getItem('timerTotalSeconds') || '0');
    
    if (isRunning && savedEndTime) {
        const endTime = parseInt(savedEndTime);
        const remainingMs = endTime - Date.now();
        
        if (remainingMs > 0) {
            timerState.isRunning = true;
            timerState.isPaused = isPaused;
            timerState.totalSeconds = totalSeconds;
            timerState.remainingSeconds = Math.ceil(remainingMs / 1000);
            timerState.startTime = Date.now() - (totalSeconds * 1000 - remainingMs);
            return true;
        }
    }
    return false;
}

function startTimer() {
    if (timerState.isRunning && !timerState.isPaused) {
        // Pause the timer
        pauseTimer();
        return;
    }
    
    if (timerState.isPaused) {
        // Resume from pause
        timerState.isPaused = false;
        timerState.startTime = Date.now() - (timerState.totalSeconds - timerState.remainingSeconds) * 1000;
    } else {
        // Start new timer
        const duration = parseFloat(timerDurationInput.value);
        if (duration >= 0.1 && duration <= 1440) {
            timerState.totalSeconds = Math.round(duration * 60);
            timerState.remainingSeconds = Math.round(duration * 60);
            timerState.startTime = Date.now();
            saveTimerDuration();
        } else {
            return;
        }
    }
    
    timerState.isRunning = true;
    timerStartBtn.textContent = 'Pause';
    timerStartBtn.classList.remove('paused');
    timerResetBtn.style.display = 'inline-block';
    if (!lastActionWasKeyboard) {
        startInactivityTimer();
    }
    lastActionWasKeyboard = false;
    saveTimerState();
    
    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.intervalId = setInterval(updateTimer, 500);
    updateTimer();
}

function pauseTimer() {
    timerState.isPaused = true;
    timerStartBtn.textContent = 'Resume';
    timerStartBtn.classList.add('paused');
    if (!lastActionWasKeyboard) {
        showTimerControls();
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(hideTimerControls, INACTIVITY_TIMEOUT);
    }
    lastActionWasKeyboard = false;
    saveTimerState();
    if (timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
    }
}

function stopTimer() {
    timerState.isRunning = false;
    timerState.isPaused = false;
    timerStartBtn.textContent = 'Start';
    timerStartBtn.classList.remove('paused');
    timerSidebarEl.classList.remove('paused');
    timerResetBtn.style.display = 'none';
    showTimerControls();
    clearTimeout(inactivityTimer);
    saveTimerState();
    
    if (timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
    }
    
    // Reset to saved duration
    loadTimerDuration();
    updateTimerDisplay();
}

function resetTimer() {
    stopTimer();
}

function updateTimer() {
    if (!timerState.isRunning || timerState.isPaused) return;
    
    const elapsed = (Date.now() - timerState.startTime) / 1000;
    timerState.remainingSeconds = Math.max(0, timerState.totalSeconds - Math.floor(elapsed));
    
    updateTimerDisplay();
    
    if (timerState.remainingSeconds <= 0) {
        timerComplete();
    }
}

function timerComplete() {
    stopTimer();
    playSchoolBell();
    timerStartBtn.textContent = 'Done!';
    
    // Flash the display
    const flipDigits = document.querySelectorAll('.flip-digit');
    flipDigits.forEach(digit => {
        digit.style.color = '#fdcb6e';
        setTimeout(() => {
            digit.style.color = '#fff';
        }, 500);
    });
}

function playSchoolBell() {
    try {
        if (!timerState.audioContext) {
            timerState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume AudioContext if suspended (browser autoplay policy)
        if (timerState.audioContext.state === 'suspended') {
            timerState.audioContext.resume();
        }
        
        const ctx = timerState.audioContext;
        const now = ctx.currentTime;
        
        // School bell melody - ding dong sound
        const notes = [
            { freq: 880, start: 0, duration: 0.3 },    // A5
            { freq: 659.25, start: 0.3, duration: 0.3 }, // E5
            { freq: 880, start: 0.6, duration: 0.3 },    // A5
            { freq: 659.25, start: 0.9, duration: 0.3 }, // E5
            { freq: 880, start: 1.2, duration: 0.5 },    // A5 (longer)
        ];
        
        notes.forEach(note => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.value = note.freq;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, now + note.start);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration);
            
            oscillator.start(now + note.start);
            oscillator.stop(now + note.start + note.duration);
        });
        
    } catch (error) {
        console.log('Could not play sound:', error);
    }
}

function updateTimerDisplay() {
    const total = timerState.remainingSeconds;
    const flipClock = document.querySelector('.flip-clock');
    
    // Determine if we should show hours (when total >= 1 hour or during countdown from hours)
    const showHours = timerState.totalSeconds >= 3600 || total >= 3600;
    
    // Toggle hours visibility
    if (showHours) {
        flipClock.classList.add('show-hours');
    } else {
        flipClock.classList.remove('show-hours');
    }
    
    if (showHours) {
        // HH:MM:SS format
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        
        const hourTens = Math.floor(hours / 10);
        const hourOnes = hours % 10;
        const minuteTens = Math.floor(minutes / 10);
        const minuteOnes = minutes % 10;
        const secondTens = Math.floor(seconds / 10);
        const secondOnes = seconds % 10;
        
        updateDigit('hour-tens', hourTens);
        updateDigit('hour-ones', hourOnes);
        updateDigit('minute-tens', minuteTens);
        updateDigit('minute-ones', minuteOnes);
        updateDigit('second-tens', secondTens);
        updateDigit('second-ones', secondOnes);
    } else {
        // MM:SS format
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        
        const minuteTens = Math.floor(minutes / 10);
        const minuteOnes = minutes % 10;
        const secondTens = Math.floor(seconds / 10);
        const secondOnes = seconds % 10;
        
        updateDigit('minute-tens', minuteTens);
        updateDigit('minute-ones', minuteOnes);
        updateDigit('second-tens', secondTens);
        updateDigit('second-ones', secondOnes);
    }
}

function updateDigit(digitId, value) {
    // Skip if value unchanged (performance optimization)
    if (digitCache[digitId] === value) return;
    
    const digitEl = document.querySelector(`[data-digit="${digitId}"]`);
    if (!digitEl) return;
    
    const staticTop = digitEl.querySelector('.digit-static .digit-top span');
    const staticBottom = digitEl.querySelector('.digit-static .digit-bottom span');
    const flipCard = digitEl.querySelector('.flip-card');
    const flipCardTop = digitEl.querySelector('.flip-card-top');
    const flipCardBottom = digitEl.querySelector('.flip-card-bottom');
    const flipCardTopSpan = digitEl.querySelector('.flip-card-top span');
    const flipCardBottomSpan = digitEl.querySelector('.flip-card-bottom span');
    
    if (!staticTop || !staticBottom || !flipCard || !flipCardTop || !flipCardBottom || !flipCardTopSpan || !flipCardBottomSpan) return;
    
    const currentValue = digitCache[digitId];
    const newValue = value.toString();
    
    // First time - just set the value without animation
    if (currentValue === null) {
        staticTop.textContent = newValue;
        staticBottom.textContent = newValue;
        digitCache[digitId] = value;
        return;
    }
    
    const currentValueStr = currentValue.toString();
    
    // Skip animation if digit hasn't changed or if already flipping
    if (currentValueStr === newValue) return;
    if (digitEl.classList.contains('flipping')) return;
    
    // Set up flip card with old and new values
    flipCardTopSpan.textContent = currentValueStr;  // Old value (will flip away)
    flipCardBottomSpan.textContent = newValue;     // New value (will flip in)
    
    // Show and trigger flip animation
    flipCard.style.display = 'block';
    digitEl.classList.add('flipping');
    
    // Update static layers when top flip completes (0.18s) - just before bottom flip starts
    // This allows the new number to be revealed behind the bottom flap as it rotates down
    setTimeout(() => {
        staticTop.textContent = newValue;
        staticBottom.textContent = newValue;
    }, 180);
    
    // Use setTimeout for cleanup - animation is 0.36s total (0.18s + 0.18s delay)
    setTimeout(() => {
        // Hide flip card
        flipCard.style.display = 'none';
        
        // Remove flipping class to reset animation
        digitEl.classList.remove('flipping');
        
        // Force reflow to reset animation state
        void digitEl.offsetWidth;
        
        // Update cache
        digitCache[digitId] = value;
    }, 360);
}

function toggleFullscreenTimer() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
    }
    if (timerSidebarEl.classList.contains('fullscreen')) {
        timerSidebarEl.classList.remove('fullscreen');
        document.body.style.overflow = '';
        return;
    }
    const el = timerSidebarEl && typeof timerSidebarEl.requestFullscreen === 'function'
        ? timerSidebarEl
        : document.documentElement;
    el.requestFullscreen().catch(() => {});
    timerSidebarEl.classList.add('fullscreen');
    document.body.style.overflow = 'hidden';
}

// Handle fullscreen change events
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        timerSidebarEl.classList.remove('fullscreen');
        document.body.style.overflow = '';
    }
});

function openTimer() {
    toggleTimerSidebar();
}

function openMotivation() {
    showRandomQuote();
}

function showRandomQuote() {
    const quoteModal = document.getElementById('quoteModal');
    const quoteText = document.getElementById('quoteText');
    const newQuoteBtn = document.getElementById('newQuoteBtn');
    const closeQuoteBtn = document.getElementById('closeQuoteBtn');
    
    if (!quoteModal || !quoteText) return;
    
    quoteText.textContent = getRandomQuote();
    quoteModal.classList.add('visible');
    
    const closeQuote = () => {
        quoteModal.classList.remove('visible');
    };
    
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            closeQuote();
            document.removeEventListener('keydown', handleKeydown);
            return;
        }
        
        if (e.key === 'Enter') {
            if (document.activeElement === newQuoteBtn) {
                newQuoteBtn.click();
            } else if (document.activeElement === closeQuoteBtn) {
                closeQuote();
                document.removeEventListener('keydown', handleKeydown);
            }
            return;
        }
        
        if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            
            const buttons = [newQuoteBtn, closeQuoteBtn];
            const currentIndex = document.activeElement === newQuoteBtn ? 0 : document.activeElement === closeQuoteBtn ? 1 : -1;
            
            if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (e.shiftKey) {
                    if (currentIndex > 0) {
                        buttons[currentIndex - 1].focus();
                    }
                } else {
                    if (currentIndex < buttons.length - 1) {
                        buttons[currentIndex + 1].focus();
                    }
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (currentIndex > 0) {
                    buttons[currentIndex - 1].focus();
                }
            }
            return;
        }
    };
    
    document.addEventListener('keydown', handleKeydown);
    
    newQuoteBtn.onclick = () => {
        const dialog = quoteModal.querySelector('.confirm-dialog');
        dialog.style.animation = 'none';
        dialog.offsetHeight; 
        dialog.style.animation = '';
        
        quoteText.style.animation = 'none';
        quoteText.offsetHeight; 
        quoteText.style.animation = '';
        quoteText.textContent = getRandomQuote();
    };
    
    closeQuoteBtn.onclick = closeQuote;
    quoteModal.onclick = (e) => {
        if (e.target === quoteModal) {
            closeQuote();
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    
    newQuoteBtn.focus();
}

function setupEventListeners() {
    const addSubjectBtn = document.getElementById('addSubjectBtn');
    if (addSubjectBtn) {
        addSubjectBtn.addEventListener('click', addSubject);
    }

    backBtn.addEventListener('click', closeSubjectView);
    
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    
    function openSidebar() {
        syncExamSidebarSize();
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
        updateSidebarOverlay();
    }
    
    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        updateSidebarOverlay();
    }
    
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', openSidebar);
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSidebar();
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSidebar();
        });
    }
    
    // Sidebar itself should NOT close when clicking inside - only the overlay or close button should
    sidebar.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('active') && !isResizing) {
            closeSidebar();
            e.preventDefault();
        }
    });
    
    // Exams sidebar resize handle
    const examsResizeHandle = document.getElementById('examsResizeHandle');
    const EXAMS_SIDEBAR_MIN_RATIO = 0.2;
    const EXAMS_SIDEBAR_MAX_RATIO = 0.5;
    const EXAMS_RESIZE_HANDLE_WIDTH = 12;
    let isResizing = false;
    let activePointerId = null;
    let startX = 0;
    let startWidth = 0;

    const getExamSidebarBounds = () => {
        const viewportWidth = window.innerWidth || 1200;
        return {
            minWidth: Math.floor(viewportWidth * EXAMS_SIDEBAR_MIN_RATIO),
            maxWidth: Math.floor(viewportWidth * EXAMS_SIDEBAR_MAX_RATIO)
        };
    };

    const clampExamSidebarWidth = () => {
        const { minWidth, maxWidth } = getExamSidebarBounds();
        const currentWidth = sidebar.getBoundingClientRect().width || maxWidth;
        const clamped = Math.max(minWidth, Math.min(currentWidth, maxWidth));
        sidebar.style.width = `${clamped}px`;
        return clamped;
    };

    const positionExamsResizeHandle = () => {
        if (!examsResizeHandle) return;
        const sidebarWidth = sidebar.getBoundingClientRect().width;
        examsResizeHandle.style.setProperty('--slide-offset', `${Math.max(0, sidebarWidth)}px`);
        examsResizeHandle.style.left = `${Math.max(0, sidebarWidth - EXAMS_RESIZE_HANDLE_WIDTH)}px`;
    };

    const syncExamSidebarSize = () => {
        clampExamSidebarWidth();
        positionExamsResizeHandle();
    };

    const startResize = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        isResizing = true;
        activePointerId = event.pointerId ?? 'mouse';
        startX = event.clientX;
        startWidth = sidebar.getBoundingClientRect().width;
        if (event.pointerId !== undefined && examsResizeHandle.setPointerCapture) {
            examsResizeHandle.setPointerCapture(event.pointerId);
        }
        document.body.classList.add('is-resizing-sidebar');
        examsResizeHandle.classList.add('active');
        event.preventDefault();
        event.stopPropagation();
    };

    const doResize = (event) => {
        if (!isResizing) return;
        if (event.pointerId !== undefined && event.pointerId !== activePointerId) return;
        const diff = event.clientX - startX;
        const { minWidth, maxWidth } = getExamSidebarBounds();
        const nextWidth = Math.max(minWidth, Math.min(startWidth + diff, maxWidth));
        sidebar.style.width = `${nextWidth}px`;
        positionExamsResizeHandle();
        event.preventDefault();
    };

    const stopResize = (event) => {
        if (!isResizing) return;
        if (event?.pointerId !== undefined && event.pointerId !== activePointerId) return;
        if (
            event?.pointerId !== undefined &&
            examsResizeHandle.hasPointerCapture &&
            examsResizeHandle.hasPointerCapture(event.pointerId)
        ) {
            examsResizeHandle.releasePointerCapture(event.pointerId);
        }
        isResizing = false;
        activePointerId = null;
        document.body.classList.remove('is-resizing-sidebar');
        examsResizeHandle.classList.remove('active');
    };

    if (examsResizeHandle) {
        syncExamSidebarSize();
        examsResizeHandle.addEventListener('pointerdown', startResize);
        examsResizeHandle.addEventListener('pointermove', doResize);
        examsResizeHandle.addEventListener('pointerup', stopResize);
        examsResizeHandle.addEventListener('pointercancel', stopResize);
        window.addEventListener('resize', syncExamSidebarSize);
    }
    
    let currentExamName = '';
    let exams = [];
    let currentExam = null;
    const sidebarContent = document.querySelector('#sidebar .sidebar-content');
    
    const addExamBtn = document.getElementById('addExamBtn');
    const addExamModal = document.getElementById('addExamModal');
    const newExamNameInput = document.getElementById('newExamName');
    const cancelAddExamBtn = document.getElementById('cancelAddExam');
    const confirmAddExamBtn = document.getElementById('confirmAddExam');
    
    const templateModal = document.getElementById('templateModal');
    const cancelTemplateBtn = document.getElementById('cancelTemplate');
    const templateButtons = document.querySelectorAll('.template-btn');
    
    const openTemplateModal = function() {
        if (templateModal) {
            templateModal.classList.add('visible');
        }
    };
    
    const closeTemplateModal = function() {
        if (templateModal) {
            templateModal.classList.remove('visible');
        }
    };
    
    if (cancelTemplateBtn) {
        cancelTemplateBtn.addEventListener('click', closeTemplateModal);
    }
    
    if (templateModal) {
        templateModal.addEventListener('click', function(e) {
            if (e.target === templateModal) closeTemplateModal();
        });
    }
    
    templateButtons.forEach(function(btn) {
        btn.addEventListener('click', async function() {
            const template = btn.dataset.template;
            try {
                const response = await fetch('/api/exams', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: currentExamName, template: template })
                });
                const data = await response.json();
                if (data.success) {
                    await loadExamsList();
                    closeTemplateModal();
                    closeAddExamModal();
                    closeSidebar();
                } else {
                    alert(data.error || 'Failed to create exam');
                }
            } catch (err) {
                console.error('Error creating exam:', err);
                alert('Error creating exam');
            }
        });
    });
    
    const openAddExamModal = function() {
        if (addExamModal) {
            addExamModal.classList.add('visible');
            if (newExamNameInput) newExamNameInput.focus();
        }
    };
    
    const closeAddExamModal = function() {
        if (addExamModal) {
            addExamModal.classList.remove('visible');
            if (newExamNameInput) newExamNameInput.value = '';
        }
    };
    
    if (addExamBtn) {
        addExamBtn.addEventListener('click', openAddExamModal);
    }
    
    if (cancelAddExamBtn) {
        cancelAddExamBtn.addEventListener('click', closeAddExamModal);
    }
    
    if (confirmAddExamBtn) {
        confirmAddExamBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const examName = newExamNameInput?.value.trim();
            if (examName) {
                currentExamName = examName;
                closeAddExamModal();
                openTemplateModal();
            } else {
                alert('Please enter an exam name');
            }
        });
    }
    
    function renderExamsList() {
        if (!sidebarContent) return;

        sidebarContent.innerHTML = '';
        if (!exams.length) {
            sidebarContent.innerHTML = '<p class="no-data">No exams yet.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        exams.forEach((exam, index) => {
            const examItem = document.createElement('div');
            examItem.className = 'exam-item';
            examItem.dataset.exam = exam.name;
            examItem.addEventListener('click', () => window.switchExam(exam.name));

            const examInfo = document.createElement('div');
            examInfo.className = 'exam-info';

            const examNameEl = document.createElement('span');
            examNameEl.className = `exam-name${exam.name === currentExam ? ' active' : ''}`;
            examNameEl.textContent = exam.name;

            const subjectsCount = document.createElement('span');
            subjectsCount.className = 'exam-subjects-count';
            const count = Array.isArray(exam.subjects) ? exam.subjects.length : 0;
            subjectsCount.textContent = `${count} subjects`;

            examInfo.appendChild(examNameEl);
            examInfo.appendChild(subjectsCount);

            const actions = document.createElement('div');
            actions.className = 'exam-actions';

            const editActions = document.createElement('div');
            editActions.className = 'exam-edit-actions';

            const renameBtn = document.createElement('button');
            renameBtn.className = 'exam-action-btn rename';
            renameBtn.title = 'Rename';
            renameBtn.textContent = '\u270F\uFE0F';
            renameBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                window.renameExam(exam.name);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'exam-action-btn delete';
            deleteBtn.title = 'Delete';
            deleteBtn.textContent = '\uD83D\uDDD1\uFE0F';
            deleteBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                window.deleteExam(exam.name);
            });

            editActions.appendChild(renameBtn);
            editActions.appendChild(deleteBtn);

            const moveActions = document.createElement('div');
            moveActions.className = 'exam-move-actions';

            const moveUpBtn = document.createElement('button');
            moveUpBtn.className = 'exam-move-btn';
            moveUpBtn.setAttribute('aria-label', 'Move up');
            moveUpBtn.textContent = '\u25B2';
            moveUpBtn.disabled = index === 0;
            moveUpBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await moveExam(index, -1);
            });

            const moveDownBtn = document.createElement('button');
            moveDownBtn.className = 'exam-move-btn';
            moveDownBtn.setAttribute('aria-label', 'Move down');
            moveDownBtn.textContent = '\u25BC';
            moveDownBtn.disabled = index === exams.length - 1;
            moveDownBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await moveExam(index, 1);
            });

            moveActions.appendChild(moveUpBtn);
            moveActions.appendChild(moveDownBtn);

            actions.appendChild(editActions);
            actions.appendChild(moveActions);

            examItem.appendChild(examInfo);
            examItem.appendChild(actions);
            fragment.appendChild(examItem);
        });

        sidebarContent.appendChild(fragment);
    }

    async function saveExamOrder() {
        const response = await fetch('/api/exams/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: exams.map((exam) => exam.name) })
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to reorder exams');
        }
    }

    async function moveExam(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= exams.length) return null;

        const next = [...exams];
        const [moved] = next.splice(index, 1);
        next.splice(targetIndex, 0, moved);
        exams = next;
        renderExamsList();

        try {
            await saveExamOrder();
        } catch (err) {
            console.error('Error reordering exams:', err);
            await loadExamsList();
            alert('Could not save exam order.');
        }

        return targetIndex;
    }

    async function loadExamsList() {
        try {
            const response = await fetch('/api/exams');
            const data = await response.json();
            exams = Array.isArray(data.exams) ? data.exams : [];
            currentExam = data.currentExam || null;
            hasCurrentExam = Boolean(currentExam);
            updateSubjectPanelState();
            renderExamsList();
        } catch (err) {
            console.error('Error loading exams:', err);
        }
    }

    window.switchExam = async function(examName) {
        try {
            const response = await fetch('/api/exam/set-current', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam: examName })
            });
            const data = await response.json();
            if (data.success) {
                location.reload();
            }
        } catch (err) {
            console.error('Error switching exam:', err);
        }
    };
    
    window.renameExam = async function(examName) {
        renameTitleEl.textContent = 'Rename Exam';
        renameInputEl.value = examName;
        renameModalEl.classList.add('visible');
        setTimeout(() => renameInputEl.focus(), 10);
        
        pendingRenameCallback = async (newName) => {
            if (!newName || newName === examName) return;
            try {
                const response = await fetch('/api/exam/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldName: examName, newName: newName })
                });
                const data = await response.json();
                if (data.success) {
                    loadExamsList();
                } else {
                    alert(data.error || 'Failed to rename exam');
                }
            } catch (err) {
                console.error('Error renaming exam:', err);
            }
        };
    };
    
    window.deleteExam = async function(examName) {
        confirmMessageEl.textContent = `Delete exam "${examName}"? All data will be lost.`;
        confirmOkBtn.textContent = 'Delete';
        confirmModalEl.classList.add('visible');
        
        pendingDeleteCallback = async () => {
            try {
                const response = await fetch('/api/exam', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exam: examName })
                });
                const data = await response.json();
                if (data.success) {
                    loadExamsList();
                } else {
                    alert(data.error || 'Failed to delete exam');
                }
            } catch (err) {
                console.error('Error deleting exam:', err);
            }
        };
        setTimeout(() => confirmCancelBtn.focus(), 10);
    };
    
    loadExamsList();
    
    uploadPortionBtn.addEventListener('click', () => {
        if (!currentSubject) return;
        portionFileInput.click();
    });
    portionFileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        await uploadPortionFiles(files);
        portionFileInput.value = '';
    });
    uploadWorksheetBtn.addEventListener('click', () => {
        if (!currentSubject) return;
        worksheetFileInput.click();
    });
    worksheetFileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        await uploadWorksheetFiles(files);
        worksheetFileInput.value = '';
    });
    
    addLearningMaterialBtn.addEventListener('click', () => {
        if (!currentSubject) return;
        openLearningMaterialModal();
    });
    
    learningMaterialModal = document.getElementById('learningMaterialModal');
    learningMaterialUrlInput = document.getElementById('learningMaterialUrl');
    learningMaterialFileInputModal = document.getElementById('learningMaterialFileInputModal');
    learningMaterialNameInput = document.getElementById('learningMaterialName');
    cancelLearningMaterialBtn = document.getElementById('cancelLearningMaterial');
    addLearningMaterialConfirmBtn = document.getElementById('addLearningMaterialConfirm');
    addLearningMaterialFileBtn = document.getElementById('addLearningMaterialFileBtn');
    selectedLearningMaterialFile = null;
    
    function openLearningMaterialModal() {
        learningMaterialUrlInput.value = '';
        learningMaterialFileInputModal.value = '';
        learningMaterialNameInput.value = '';
        selectedLearningMaterialFile = null;
        updateUrlInputStyle();
        learningMaterialModal.classList.add('visible');
        addLearningMaterialFileBtn.focus();
    }
    
    function updateUrlInputStyle() {
        const url = learningMaterialUrlInput.value.trim();
        if (isValidUrl(url)) {
            learningMaterialUrlInput.style.color = '#4da6ff';
            learningMaterialUrlInput.style.cursor = 'pointer';
        } else {
            learningMaterialUrlInput.style.color = '';
            learningMaterialUrlInput.style.cursor = '';
        }
    }
    
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    learningMaterialUrlInput.addEventListener('input', updateUrlInputStyle);
    
    learningMaterialUrlInput.addEventListener('click', () => {
        const url = learningMaterialUrlInput.value.trim();
        if (isValidUrl(url)) {
            window.open(url, '_blank');
        }
    });
    
    function closeLearningMaterialModal() {
        learningMaterialModal.classList.remove('visible');
        selectedLearningMaterialFile = null;
    }
    
    addLearningMaterialFileBtn.addEventListener('click', () => {
        learningMaterialFileInputModal.click();
    });
    
    learningMaterialFileInputModal.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            selectedLearningMaterialFile = files[0];
            const file = selectedLearningMaterialFile;
            const icon = getLearningMaterialIcon(file.type);
            learningMaterialUrlInput.value = icon + ' ' + file.name;
            if (!learningMaterialNameInput.value) {
                learningMaterialNameInput.value = file.name;
            }
        }
    });
    
    cancelLearningMaterialBtn.addEventListener('click', closeLearningMaterialModal);
    
    learningMaterialModal.addEventListener('click', (e) => {
        if (e.target === learningMaterialModal) closeLearningMaterialModal();
    });
    
    // Keyboard navigation for modal
    const learningMaterialModalInputs = [addLearningMaterialFileBtn, learningMaterialUrlInput, learningMaterialNameInput, cancelLearningMaterialBtn, addLearningMaterialConfirmBtn];
    
    learningMaterialModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLearningMaterialModal();
            return;
        }
        
        if (e.key === 'Enter') {
            const activeEl = document.activeElement;
            if (activeEl === addLearningMaterialConfirmBtn || activeEl === learningMaterialNameInput) {
                addLearningMaterialConfirmBtn.click();
            }
            return;
        }
        
        if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const currentIndex = learningMaterialModalInputs.indexOf(document.activeElement);
            let nextIndex;
            if (currentIndex === -1) {
                nextIndex = 0;
            } else if (e.shiftKey) {
                nextIndex = currentIndex === 0 ? learningMaterialModalInputs.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex === learningMaterialModalInputs.length - 1 ? 0 : currentIndex + 1;
            }
            learningMaterialModalInputs[nextIndex].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const currentIndex = learningMaterialModalInputs.indexOf(document.activeElement);
            if (currentIndex <= 0) {
                learningMaterialModalInputs[learningMaterialModalInputs.length - 1].focus();
            } else {
                learningMaterialModalInputs[currentIndex - 1].focus();
            }
        }
    });
    
    addLearningMaterialConfirmBtn.addEventListener('click', function() {
        const url = learningMaterialUrlInput.value.trim();
        const name = learningMaterialNameInput.value.trim();
        
        if (!name) {
            learningMaterialNameInput.focus();
            return;
        }
        
        if (selectedLearningMaterialFile) {
            uploadLearningMaterialFile(selectedLearningMaterialFile, name);
        } else if (url) {
            addLearningMaterialLink(url, name);
        }
        
        closeLearningMaterialModal();
    });
    learningMaterialFileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        await uploadLearningMaterialFiles(files);
        learningMaterialFileInput.value = '';
    });
    togglePdfBtn.addEventListener('click', togglePdfSidebar);
    const closePdfSidebarBtn = document.getElementById('closePdfSidebarBtn');
    if (closePdfSidebarBtn) {
        closePdfSidebarBtn.addEventListener('click', closePdfSidebar);
    }
    if (uploadGlobalPortionBtn && globalPortionFileInput) {
        uploadGlobalPortionBtn.addEventListener('click', () => {
            globalPortionFileInput.click();
        });
        globalPortionFileInput.addEventListener('change', async (event) => {
            const files = event.target.files;
            await uploadGlobalPortionFiles(files);
            globalPortionFileInput.value = '';
        });
    }
    if (portionSequenceViewerEl) {
        portionSequenceViewerEl.addEventListener('scroll', maybeAppendNextPortion);
    }
    
    // Add click handler for overlay to close all sidebars
    sidebarOverlayEl.addEventListener('click', () => {
        closeSidebar();
        closePdfSidebar();
        closePreview();
        closeTimerSidebar();
    });
    
    // Preview sidebar events
    closePreviewBtn.addEventListener('click', closePreview);
    fullscreenPreviewBtn.addEventListener('click', toggleFullscreenPreview);
    
    timerBtn.addEventListener('click', openTimer);
    motivationBtn.addEventListener('click', openMotivation);
    
    // Timer sidebar events
    closeTimerBtn.addEventListener('click', closeTimerSidebar);
    timerStartBtn.addEventListener('click', startTimer);
    timerResetBtn.addEventListener('click', resetTimer);
    timerDurationInput.addEventListener('change', () => {
        const duration = parseFloat(timerDurationInput.value);
        if (duration >= 0.1 && duration <= 1440) {
            if (!timerState.isRunning) {
                timerState.totalSeconds = Math.round(duration * 60);
                timerState.remainingSeconds = Math.round(duration * 60);
                updateTimerDisplay();
            }
            saveTimerDuration();
        }
    });
    timerFullscreenBtn.addEventListener('click', toggleFullscreenTimer);
    
    // Show controls when mouse is near them
    document.addEventListener('mousemove', (e) => {
        if (!timerSidebarEl.classList.contains('open')) return;
        if (!timerControlsEl) return;
        
        const controlsRect = timerControlsEl.getBoundingClientRect();
        const buffer = 80;
        if (e.clientX >= controlsRect.left - buffer && 
            e.clientX <= controlsRect.right + buffer &&
            e.clientY >= controlsRect.top - buffer && 
            e.clientY <= controlsRect.bottom + buffer) {
            showTimerControls();
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(hideTimerControls, INACTIVITY_TIMEOUT);
        }
    });
    
    savePlanBtn.addEventListener('click', savePlan);
    
    // Plan editor Ctrl+S shortcut and Tab navigation
    planEditorEl.addEventListener('keydown', (e) => {
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            savePlan();
        } else if (e.key === 'Tab') {
            // Navigate to next block when Tab is pressed in plan editor
            e.preventDefault();
            const blocks = [
                { sectionId: 'portionSection', contentId: 'portionContent', type: 'portion' },
                { sectionId: 'worksheetSection', contentId: 'worksheetsList', type: 'worksheet' },
                { sectionId: 'planSection', contentId: 'planEditor', type: 'plan' },
                { sectionId: 'learningMaterialSection', contentId: 'learningMaterialList', type: 'learningMaterial' },
                { sectionId: 'todoSection', contentId: 'todoList', type: 'todo' }
            ];
            const currentBlockIndex = 2; // plan is at index 2
            const direction = e.shiftKey ? -1 : 1;
            let nextIndex = currentBlockIndex + direction;
            
            if (nextIndex < 0) nextIndex = blocks.length - 1;
            if (nextIndex >= blocks.length) nextIndex = 0;
            
            const nextBlock = blocks[nextIndex];
            const nextSectionEl = document.getElementById(nextBlock.sectionId);
            
            if (nextSectionEl) {
                nextSectionEl.focus();
                highlightBlock(nextBlock.type);
                currentIndices[nextBlock.type] = 0;
            }
        }
    });

    // To-Do event listeners
    const addTodoBtn = document.getElementById('addTodoBtn');
    const todoInput = document.getElementById('todoInput');
    const todoInputContainer = document.getElementById('todoInputContainer');
    const todoAutocomplete = document.getElementById('todoAutocomplete');
    const todoList = document.getElementById('todoList');
    const todoSection = document.getElementById('todoSection');
    const submitTodoBtn = document.getElementById('submitTodoBtn');
    
    let autocompleteFiles = [];
    let selectedAutocompleteIndex = -1;
    
    // Load all files for autocomplete when subject changes
    async function loadAutocompleteFiles() {
        if (!currentSubject) return;
        
        try {
            // Load worksheets only (not portion images)
            const worksheetResponse = await fetch(`/api/worksheets?subject=${encodeURIComponent(currentSubject.id)}`);
            if (worksheetResponse.ok) {
                const worksheets = await worksheetResponse.json();
                autocompleteFiles = worksheets.map(ws => ({
                    name: ws.name,
                    type: 'worksheet',
                    path: ws.file
                }));
            }
        } catch (error) {
            console.error('Error loading files for autocomplete:', error);
        }
    }
    
    // Show autocomplete dropdown
    function showAutocomplete(searchTerm = '') {
        if (!todoAutocomplete) return;
        
        const filteredFiles = autocompleteFiles.filter(file => 
            file.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (filteredFiles.length === 0) {
            todoAutocomplete.classList.remove('visible');
            return;
        }
        
        todoAutocomplete.innerHTML = filteredFiles.map((file, index) => `
            <div class="autocomplete-item ${index === selectedAutocompleteIndex ? 'selected' : ''}" data-index="${index}">
                <span class="autocomplete-item-icon">${file.type === 'worksheet' ? '📄' : '🖼️'}</span>
                <span>${file.name}</span>
            </div>
        `).join('');
        
        todoAutocomplete.classList.add('visible');
        
        // Add click handlers
        todoAutocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                selectAutocompleteFile(filteredFiles[index]);
            });
        });
    }
    
    // Select autocomplete file
    function selectAutocompleteFile(file) {
        const cursorPos = todoInput.selectionStart;
        const textBefore = todoInput.value.substring(0, cursorPos);
        const textAfter = todoInput.value.substring(cursorPos);
        
        // Find the @ symbol position
        const atIndex = textBefore.lastIndexOf('@');
        if (atIndex !== -1) {
            const newText = textBefore.substring(0, atIndex) + '@' + file.name + ' ' + textAfter;
            todoInput.value = newText;
            todoInput.focus();
            todoInput.setSelectionRange(atIndex + file.name.length + 2, atIndex + file.name.length + 2);
        }
        
        hideAutocomplete();
    }
    
    // Hide autocomplete
    function hideAutocomplete() {
        if (todoAutocomplete) {
            todoAutocomplete.classList.remove('visible');
        }
        selectedAutocompleteIndex = -1;
    }
    
    if (addTodoBtn && todoInput) {
        addTodoBtn.addEventListener('click', () => {
            todoInputContainer.style.display = 'block';
            todoInput.focus();
            addTodoBtn.style.display = 'none';
            loadAutocompleteFiles();
        });
        
        // Drag and drop for add button
        addTodoBtn.addEventListener('dragover', (e) => {
            e.preventDefault();
            addTodoBtn.classList.add('drag-over');
        });
        
        addTodoBtn.addEventListener('dragleave', () => {
            addTodoBtn.classList.remove('drag-over');
        });
        
        addTodoBtn.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addTodoBtn.classList.remove('drag-over');
            
            // Show input field for editing
            todoInputContainer.style.display = 'block';
            addTodoBtn.style.display = 'none';
            loadAutocompleteFiles();
            
            // Insert file reference at current cursor position or at the end
            const cursorPos = todoInput.selectionStart;
            const textBefore = todoInput.value.substring(0, cursorPos);
            const textAfter = todoInput.value.substring(cursorPos);
            
            // Check for dragged worksheet data
            const draggedData = e.dataTransfer.getData('text/plain');
            if (draggedData) {
                try {
                    const data = JSON.parse(draggedData);
                    if (data.name) {
                        todoInput.value = textBefore + `@${data.name} ` + textAfter;
                        todoInput.focus();
                        const newCursorPos = cursorPos + data.name.length + 2;
                        todoInput.setSelectionRange(newCursorPos, newCursorPos);
                        return;
                    }
                } catch (err) {
                    // Not JSON data, continue to file handling
                }
            }
            
            // Handle file system drops
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
                todoInput.value = textBefore + `@${fileName} ` + textAfter;
                todoInput.focus();
                const newCursorPos = cursorPos + fileName.length + 2;
                todoInput.setSelectionRange(newCursorPos, newCursorPos);
            }
        });
        
        // Drag and drop for todo section
        todoSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            todoSection.classList.add('drag-over');
        });
        
        todoSection.addEventListener('dragleave', () => {
            todoSection.classList.remove('drag-over');
        });
        
        todoSection.addEventListener('drop', (e) => {
            e.preventDefault();
            todoSection.classList.remove('drag-over');
            
            // Show input field for editing
            todoInputContainer.style.display = 'block';
            addTodoBtn.style.display = 'none';
            loadAutocompleteFiles();
            
            // Insert file reference at current cursor position or at the end
            const cursorPos = todoInput.selectionStart;
            const textBefore = todoInput.value.substring(0, cursorPos);
            const textAfter = todoInput.value.substring(cursorPos);
            
            // Check for dragged worksheet data
            const draggedData = e.dataTransfer.getData('text/plain');
            if (draggedData) {
                try {
                    const data = JSON.parse(draggedData);
                    if (data.name) {
                        todoInput.value = textBefore + `@${data.name} ` + textAfter;
                        todoInput.focus();
                        const newCursorPos = cursorPos + data.name.length + 2;
                        todoInput.setSelectionRange(newCursorPos, newCursorPos);
                        return;
                    }
                } catch (err) {
                    // Not JSON data, continue to file handling
                }
            }
            
            // Handle file system drops
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
                todoInput.value = textBefore + `@${fileName} ` + textAfter;
                todoInput.focus();
                const newCursorPos = cursorPos + fileName.length + 2;
                todoInput.setSelectionRange(newCursorPos, newCursorPos);
            }
        });
        
        todoInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = todoInput.value.trim();
                if (text) {
                    await addTodo(text);
                }
                todoInput.value = '';
                todoInputContainer.style.display = 'none';
                addTodoBtn.style.display = 'inline-block';
                hideAutocomplete();
            } else if (e.key === 'Escape') {
                todoInput.value = '';
                todoInputContainer.style.display = 'none';
                addTodoBtn.style.display = 'inline-block';
                hideAutocomplete();
            } else if (e.key === '@') {
                // Show file reference autocomplete
                setTimeout(() => {
                    const cursorPos = todoInput.selectionStart;
                    const textBefore = todoInput.value.substring(0, cursorPos);
                    const searchTerm = textBefore.substring(textBefore.lastIndexOf('@') + 1);
                    selectedAutocompleteIndex = -1;
                    showAutocomplete(searchTerm);
                }, 10);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (todoAutocomplete.classList.contains('visible')) {
                    e.preventDefault();
                    const items = todoAutocomplete.querySelectorAll('.autocomplete-item');
                    if (items.length > 0) {
                        if (e.key === 'ArrowDown') {
                            selectedAutocompleteIndex = (selectedAutocompleteIndex + 1) % items.length;
                        } else {
                            selectedAutocompleteIndex = selectedAutocompleteIndex <= 0 ? items.length - 1 : selectedAutocompleteIndex - 1;
                        }
                        items.forEach((item, index) => {
                            item.classList.toggle('selected', index === selectedAutocompleteIndex);
                        });
                    }
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (todoAutocomplete.classList.contains('visible')) {
                    // Navigate autocomplete items
                    const items = todoAutocomplete.querySelectorAll('.autocomplete-item');
                    if (items.length > 0 && selectedAutocompleteIndex >= 0) {
                        const selectedFile = autocompleteFiles[selectedAutocompleteIndex];
                        if (selectedFile) {
                            selectAutocompleteFile(selectedFile);
                        }
                    }
                } else {
                    // Navigate to next block
                    const blocks = [
                        { sectionId: 'portionSection', contentId: 'portionContent', type: 'portion' },
                        { sectionId: 'worksheetSection', contentId: 'worksheetsList', type: 'worksheet' },
                        { sectionId: 'planSection', contentId: 'planEditor', type: 'plan' },
                        { sectionId: 'learningMaterialSection', contentId: 'learningMaterialList', type: 'learningMaterial' },
                        { sectionId: 'todoSection', contentId: 'todoList', type: 'todo' }
                    ];
                    const currentBlockIndex = 4; // todo is at index 4
                    const direction = e.shiftKey ? -1 : 1;
                    let nextIndex = currentBlockIndex + direction;
                    
                    if (nextIndex < 0) nextIndex = blocks.length - 1;
                    if (nextIndex >= blocks.length) nextIndex = 0;
                    
                    const nextBlock = blocks[nextIndex];
                    const nextSectionEl = document.getElementById(nextBlock.sectionId);
                    
                    if (nextSectionEl) {
                        // Hide the input first
                        todoInputContainer.style.display = 'none';
                        addTodoBtn.style.display = 'inline-block';
                        
                        nextSectionEl.focus();
                        highlightBlock(nextBlock.type);
                        currentIndices[nextBlock.type] = 0;
                    }
                }
            } else {
                // Update autocomplete as user types
                setTimeout(() => {
                    const cursorPos = todoInput.selectionStart;
                    const textBefore = todoInput.value.substring(0, cursorPos);
                    const atIndex = textBefore.lastIndexOf('@');
                    if (atIndex !== -1) {
                        const searchTerm = textBefore.substring(atIndex + 1);
                        selectedAutocompleteIndex = -1;
                        showAutocomplete(searchTerm);
                    } else {
                        hideAutocomplete();
                    }
                }, 10);
            }
        });
        
        // Submit button click handler
        if (submitTodoBtn) {
            submitTodoBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const text = todoInput.value.trim();
                if (text) {
                    await addTodo(text);
                }
                todoInput.value = '';
                todoInputContainer.style.display = 'none';
                addTodoBtn.style.display = 'inline-block';
                hideAutocomplete();
            });
        }
        
        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!todoInputContainer.contains(e.target) && !addTodoBtn.contains(e.target)) {
                hideAutocomplete();
                if (todoInputContainer.style.display === 'block') {
                    if (todoInput.value.trim()) {
                        addTodo(todoInput.value.trim());
                    }
                    todoInput.value = '';
                    todoInputContainer.style.display = 'none';
                    addTodoBtn.style.display = 'inline-block';
                }
            }
        });
    }

    confirmCancelBtn.addEventListener('click', () => {
        confirmModalEl.classList.remove('visible');
        pendingDeleteCallback = null;
    });
    confirmOkBtn.addEventListener('click', () => {
        if (pendingDeleteCallback) {
            pendingDeleteCallback();
        }
        confirmModalEl.classList.remove('visible');
        pendingDeleteCallback = null;
    });
    confirmModalEl.addEventListener('click', (e) => {
        if (e.target === confirmModalEl) {
            confirmModalEl.classList.remove('visible');
            pendingDeleteCallback = null;
        }
    });

    // Confirm dialog keyboard navigation
    confirmModalEl.addEventListener('keydown', (e) => {
        if (!confirmModalEl.classList.contains('visible')) return;
        e.stopPropagation();

        if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
            e.preventDefault();
            if (document.activeElement === confirmCancelBtn) {
                confirmOkBtn.focus();
            } else {
                confirmCancelBtn.focus();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (document.activeElement === confirmOkBtn && pendingDeleteCallback) {
                pendingDeleteCallback();
            }
            confirmModalEl.classList.remove('visible');
            pendingDeleteCallback = null;
        } else if (e.key === 'Escape') {
            e.preventDefault();
            confirmModalEl.classList.remove('visible');
            pendingDeleteCallback = null;
        }
    });

    // Rename modal handlers
    renameCancelBtn.addEventListener('click', () => {
        renameModalEl.classList.remove('visible');
        pendingRenameCallback = null;
    });
    renameOkBtn.addEventListener('click', () => {
        if (pendingRenameCallback) {
            pendingRenameCallback(renameInputEl.value);
        }
        renameModalEl.classList.remove('visible');
        pendingRenameCallback = null;
    });
    renameModalEl.addEventListener('click', (e) => {
        if (e.target === renameModalEl) {
            renameModalEl.classList.remove('visible');
            pendingRenameCallback = null;
        }
    });
    renameModalEl.addEventListener('keydown', (e) => {
        if (!renameModalEl.classList.contains('visible')) return;
        e.stopPropagation();
        
        if (e.key === 'Escape') {
            e.preventDefault();
            renameModalEl.classList.remove('visible');
            pendingRenameCallback = null;
        } else if (e.key === '/') {
            e.preventDefault();
            renameInputEl.focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (document.activeElement === renameInputEl) {
                renameOkBtn.focus();
            } else if (document.activeElement === renameOkBtn) {
                if (pendingRenameCallback) {
                    pendingRenameCallback(renameInputEl.value);
                }
                renameModalEl.classList.remove('visible');
                pendingRenameCallback = null;
            } else if (document.activeElement === renameCancelBtn) {
                renameModalEl.classList.remove('visible');
                pendingRenameCallback = null;
            }
        } else if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
            e.preventDefault();
            if (document.activeElement === renameCancelBtn) {
                renameOkBtn.focus();
            } else {
                renameCancelBtn.focus();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        // If confirm dialog is open, don't handle any other keys
        if (confirmModalEl.classList.contains('visible')) {
            return;
        }
        
        // If rename dialog is open, don't handle any other keys
        if (renameModalEl.classList.contains('visible')) {
            return;
        }
        
        // If quote modal is open, handle it exclusively
        const quoteModal = document.getElementById('quoteModal');
        if (quoteModal && quoteModal.classList.contains('visible')) {
            if (e.key === 'Escape' || e.key === 'Tab' || e.key.startsWith('Arrow')) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            return;
        }
        
        if (e.code === 'Space' && timerSidebarEl.classList.contains('open')) {
            e.preventDefault();
            lastActionWasKeyboard = true;
            if (timerState.isRunning && !timerState.isPaused) {
                pauseTimer();
            } else {
                startTimer();
            }
            return;
        }

        if (e.key === 'Escape') {
            // If preview is in fullscreen, just exit fullscreen instead of closing
            if (previewSidebarEl.classList.contains('fullscreen')) {
                toggleFullscreenPreview();
                return;
            }
            
            // If preview is open (not fullscreen), just close it
            if (previewSidebarEl.classList.contains('open')) {
                closePreview();
                return;
            }

            // If PDF sidebar is open, close it
            if (pdfSidebarEl.classList.contains('open')) {
                closePdfSidebar();
                return;
            }

            // If timer sidebar is open, close it
            if (timerSidebarEl.classList.contains('open')) {
                closeTimerSidebar();
                return;
            }

            // If in subject view, go back to subject list
            if (currentSubject) {
                closeSubjectView();
            }
            return;
        }

        const inSubjectList = !currentSubject && subjectPanelEl.style.display !== 'none';
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        const typing = tag === 'textarea' || tag === 'input';
        
        // Handle subject list navigation (when not typing and in subject list)
        if (inSubjectList && !typing) {
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
            return;
        }

        // Handle subject view navigation (when in a subject and confirm dialog is NOT visible)
        if (currentSubject && !typing && !confirmModalEl.classList.contains('visible')) {
            handleSubjectViewNavigation(e);
        }
    });

function handleSubjectViewNavigation(e) {
    const blocks = [
        { sectionId: 'portionSection', contentId: 'portionContent', type: 'portion' },
        { sectionId: 'worksheetSection', contentId: 'worksheetsList', type: 'worksheet' },
        { sectionId: 'planSection', contentId: 'planEditor', type: 'plan' },
        { sectionId: 'learningMaterialSection', contentId: 'learningMaterialList', type: 'learningMaterial' },
        { sectionId: 'todoSection', contentId: 'todoList', type: 'todo' }
    ];

    const currentFocus = document.activeElement;
    
    // Find current block by checking focus on section container
    let currentBlockIndex = -1;
    for (let i = 0; i < blocks.length; i++) {
        const sectionEl = document.getElementById(blocks[i].sectionId);
        if (sectionEl && (sectionEl.contains(currentFocus) || currentFocus === sectionEl)) {
            currentBlockIndex = i;
            break;
        }
    }

    // If no block is focused, focus the first one (portion)
    if (currentBlockIndex === -1) {
        currentBlockIndex = 0;
    }

    const currentBlock = blocks[currentBlockIndex];
    
        // Tab/Shift+Tab: Navigate between blocks
        if (e.key === 'Tab') {
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;
            let nextIndex = currentBlockIndex + direction;
            
            if (nextIndex < 0) nextIndex = blocks.length - 1;
            if (nextIndex >= blocks.length) nextIndex = 0;
            
            const nextBlock = blocks[nextIndex];
            const nextSectionEl = document.getElementById(nextBlock.sectionId);
            
            if (nextSectionEl) {
                // Focus the section container
                nextSectionEl.focus();
                
                // Highlight ONLY the block, not the contents
                highlightBlock(nextBlock.type);
                
                // Reset item selection for the new block
                currentIndices[nextBlock.type] = 0;
            }
            return;
        }

        // Arrow keys: Navigate within blocks
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        if (currentBlock.type === 'plan') {
            // For textarea, let default behavior work
            return;
        }
        
        const contentEl = document.getElementById(currentBlock.contentId);
        const items = contentEl.querySelectorAll('.portion-item, .worksheet-item');
        if (items.length === 0) return;
        
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        let nextIndex = currentIndices[currentBlock.type] + direction;
        
        // Wrap around
        if (nextIndex < 0) nextIndex = items.length - 1;
        if (nextIndex >= items.length) nextIndex = 0;
        
        currentIndices[currentBlock.type] = nextIndex;
        highlightCurrentItem(currentBlock.type);
        return;
    }

    // Arrow Left/Right: Navigate within item actions
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        
        if (currentBlock.type === 'portion') {
            // Navigate between Up/Down buttons in portion items
            const contentEl = document.getElementById(currentBlock.contentId);
            const items = contentEl.querySelectorAll('.portion-item');
            if (items.length === 0) return;
            
            const item = items[currentIndices.portion];
            const buttons = item.querySelectorAll('.order-btn');
            if (buttons.length === 0) return;
            
            // Find currently focused button or start from beginning
            let currentButtonIndex = -1;
            buttons.forEach((btn, idx) => {
                if (btn === document.activeElement) currentButtonIndex = idx;
            });
            
            const direction = e.key === 'ArrowRight' ? 1 : -1;
            let nextButtonIndex = currentButtonIndex + direction;
            
            // If no button focused, start from first/last depending on direction
            if (currentButtonIndex === -1) {
                nextButtonIndex = e.key === 'ArrowRight' ? 0 : buttons.length - 1;
            }
            
            // Wrap around
            if (nextButtonIndex < 0) nextButtonIndex = buttons.length - 1;
            if (nextButtonIndex >= buttons.length) nextButtonIndex = 0;
            
            buttons[nextButtonIndex].focus();
            return;
        } else if (currentBlock.type === 'worksheet') {
            // Navigate between Open/Delete buttons in worksheet items
            const contentEl = document.getElementById(currentBlock.contentId);
            const items = contentEl.querySelectorAll('.worksheet-item');
            if (items.length === 0) return;
            
            const item = items[currentIndices.worksheet];
            const buttons = item.querySelectorAll('.preview-btn, .worksheet-delete-btn');
            if (buttons.length === 0) return;
            
            // Find currently focused button or start from beginning
            let currentButtonIndex = -1;
            buttons.forEach((btn, idx) => {
                if (btn === document.activeElement) currentButtonIndex = idx;
            });
            
            const direction = e.key === 'ArrowRight' ? 1 : -1;
            let nextButtonIndex = currentButtonIndex + direction;
            
            // If no button focused, start from first/last depending on direction
            if (currentButtonIndex === -1) {
                nextButtonIndex = e.key === 'ArrowRight' ? 0 : buttons.length - 1;
            }
            
            // Wrap around
            if (nextButtonIndex < 0) nextButtonIndex = buttons.length - 1;
            if (nextButtonIndex >= buttons.length) nextButtonIndex = 0;
            
            buttons[nextButtonIndex].focus();
            return;
        }
    }

    // Slash key: Focus plan textarea
    if (e.key === '/') {
        e.preventDefault();
        const planSection = document.getElementById('planSection');
        const planEditor = document.getElementById('planEditor');
        planSection.focus();
        highlightBlock('plan');
        planEditor.focus();
        return;
    }

    // Ctrl+S: Save plan (when typing in textarea)
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        savePlan();
        return;
    }

    // Enter: Activate focused item or button
    if (e.key === 'Enter') {
        e.preventDefault();
        
        // Check if a button is currently focused
        if (document.activeElement.classList.contains('order-btn')) {
            // Click the order button (Up/Down)
            document.activeElement.click();
            return;
        } else if (document.activeElement.classList.contains('preview-btn')) {
            // Click the preview button
            const file = document.activeElement.getAttribute('data-file');
            const name = document.activeElement.getAttribute('data-name');
            if (file) openPreview(file, name);
            return;
        } else if (document.activeElement.classList.contains('worksheet-delete-btn')) {
            // Click the delete button
            const file = document.activeElement.getAttribute('data-file');
            const name = document.activeElement.getAttribute('data-name');
            if (file && name) promptDeleteWorksheet(name, file);
            return;
        }
        
        // Default behavior: activate the item
        if (currentBlock.type === 'portion') {
            // Open portion image in preview
            const contentEl = document.getElementById(currentBlock.contentId);
            const items = contentEl.querySelectorAll('.portion-item');
            if (items.length > 0) {
                const item = items[currentIndices.portion];
                const img = item.querySelector('.portion-image');
                if (img && img.src) {
                    openPreview(img.src, img.alt || 'Portion Image');
                }
            }
        } else if (currentBlock.type === 'worksheet') {
            // Open worksheet in preview or new tab
            const contentEl = document.getElementById(currentBlock.contentId);
            const items = contentEl.querySelectorAll('.worksheet-item');
            if (items.length > 0) {
                const item = items[currentIndices.worksheet];
                const file = item.getAttribute('data-file');
                const name = item.getAttribute('data-name');
                if (file) {
                    // Check if Ctrl/Cmd is pressed for new tab
                    if (e.ctrlKey || e.metaKey) {
                        window.open(file, '_blank');
                    } else {
                        openPreview(file, name);
                    }
                }
            }
        }
        return;
    }

    // Delete: Remove focused worksheet
    if ((e.key === 'Delete' || e.key === 'Backspace') && currentBlock.type === 'worksheet') {
        e.preventDefault();
        
        const contentEl = document.getElementById(currentBlock.contentId);
        const items = contentEl.querySelectorAll('.worksheet-item');
        if (items.length > 0) {
            const item = items[currentIndices.worksheet];
            const file = item.getAttribute('data-file');
            const name = item.getAttribute('data-name');
            if (file && name) {
                promptDeleteWorksheet(name, file);
            }
        }
        return;
    }
}

function highlightBlock(blockType) {
    // Remove highlight from all blocks
    document.querySelectorAll('.section-container').forEach(el => {
        el.classList.remove('keyboard-focused');
    });
    
    // Add highlight to current block
    let sectionId;
    if (blockType === 'portion') {
        sectionId = 'portionSection';
    } else if (blockType === 'worksheet') {
        sectionId = 'worksheetSection';
    } else if (blockType === 'learningMaterial') {
        sectionId = 'learningMaterialSection';
    } else if (blockType === 'plan') {
        sectionId = 'planSection';
    } else if (blockType === 'todo') {
        sectionId = 'todoSection';
    }
    
    const sectionEl = document.getElementById(sectionId);
    if (sectionEl) {
        sectionEl.classList.add('keyboard-focused');
    }
}

function highlightCurrentItem(blockType) {
    // Remove previous highlights
    document.querySelectorAll('.portion-item, .worksheet-item').forEach(el => {
        el.classList.remove('keyboard-focused');
    });
    
    const contentId = blockType === 'portion' ? 'portionContent' : blockType === 'worksheet' ? 'worksheetsList' : blockType === 'learningMaterial' ? 'learningMaterialList' : blockType === 'plan' ? 'planEditor' : 'todoList';
    const contentEl = document.getElementById(contentId);
    if (!contentEl) return;
    
    const items = contentEl.querySelectorAll('.portion-item, .worksheet-item');
    if (items.length === 0) return;
    
    const index = currentIndices[blockType];
    if (index >= 0 && index < items.length) {
        items[index].classList.add('keyboard-focused');
        // Blur any focused buttons within the item
        const focusedButton = items[index].querySelector('button:focus');
        if (focusedButton) focusedButton.blur();
        // Scroll into view if needed
        items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

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
    const hasOpenSidebar = sidebar?.classList.contains('active')
        || pdfSidebarEl.classList.contains('open') 
        || previewSidebarEl.classList.contains('open')
        || timerSidebarEl.classList.contains('open');
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
    const ext = getFileExtension(safePath);

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
    } else if (['mp3', 'wav', 'flac', 'm4a'].includes(ext)) {
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

function getFileExtension(path) {
    return String(path || '')
        .split(/[?#]/, 1)[0]
        .split('.')
        .pop()
        .toLowerCase();
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

function setupTimerResize() {
    if (!resizeHandleTimerEl || !timerSidebarEl) return;
    
    let activePointerId = null;
    let startX = 0;
    let startWidth = 0;
    
    const onPointerDown = (event) => {
        activePointerId = event.pointerId;
        startX = event.clientX;
        startWidth = timerSidebarEl.getBoundingClientRect().width;
        resizeHandleTimerEl.setPointerCapture(activePointerId);
        document.body.classList.add('is-resizing-sidebar');
        event.preventDefault();
    };
    
    const onPointerMove = (event) => {
        if (event.pointerId !== activePointerId) return;
        const deltaX = startX - event.clientX;
        const { minWidth, maxWidth } = getSidebarBounds();
        const nextWidth = Math.max(minWidth, Math.min(startWidth + deltaX, maxWidth));
        timerSidebarEl.style.width = `${nextWidth}px`;
        event.preventDefault();
    };
    
    const stopResizing = (event) => {
        if (event.pointerId !== activePointerId) return;
        if (resizeHandleTimerEl.hasPointerCapture(activePointerId)) {
            resizeHandleTimerEl.releasePointerCapture(activePointerId);
        }
        activePointerId = null;
        document.body.classList.remove('is-resizing-sidebar');
    };
    
    resizeHandleTimerEl.addEventListener('pointerdown', onPointerDown);
    resizeHandleTimerEl.addEventListener('pointermove', onPointerMove);
    resizeHandleTimerEl.addEventListener('pointerup', stopResizing);
    resizeHandleTimerEl.addEventListener('pointercancel', stopResizing);
    window.addEventListener('resize', clampTimerSidebarWidth);
}

function clampTimerSidebarWidth() {
    if (!timerSidebarEl) return;
    const { minWidth, maxWidth } = getSidebarBounds();
    const currentWidth = timerSidebarEl.getBoundingClientRect().width || maxWidth;
    const clamped = Math.max(minWidth, Math.min(currentWidth, maxWidth));
    timerSidebarEl.style.width = `${clamped}px`;
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



