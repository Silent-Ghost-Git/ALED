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
const STORAGE_KEY = 'currentSubjectId';
const SUBJECT_ORDER_KEY = 'subjectOrder';
const SUBJECTS_KEY = 'subjects';

const subjectListEl = document.getElementById('subjectList');
const subjectViewEl = document.getElementById('subjectView');
const subjectPanelEl = document.getElementById('subjectPanel');
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
const backBtn = document.getElementById('backBtn');
const togglePdfBtn = document.getElementById('togglePdfBtn');
const timerBtn = document.getElementById('timerBtn');

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
const DESKTOP_PDF_MIN_WIDTH = 420;
const SIDEBAR_VIEWPORT_MAX_RATIO = 0.5;

const confirmModalEl = document.getElementById('confirmModal');
const confirmMessageEl = document.getElementById('confirmMessage');
const confirmCancelBtn = document.getElementById('confirmCancel');
const confirmOkBtn = document.getElementById('confirmOk');

let currentSubject = null;
let currentPortionImages = [];
let currentWorksheets = [];
let currentGlobalPortions = [];
let currentTodos = [];
let nextSequenceIndex = 0;
let pendingDeleteCallback = null;
let selectedSubjectId = null;
let subjects = loadSubjectsFromStorage();
let currentIndices = {
    portion: 0,
    worksheet: 0,
    plan: 0,
    todo: 0
};

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
        
        // Check if icon is SVG or emoji
        let iconHtml;
        if (subject.icon && subject.icon.trim().startsWith('<svg')) {
            // It's an SVG, render it safely
            iconHtml = `<div class="subject-icon subject-icon-svg">${subject.icon}</div>`;
        } else {
            // It's an emoji or text
            iconHtml = `<span class="subject-icon">${subject.icon || '📚'}</span>`;
        }
        
        item.innerHTML = `
            ${iconHtml}
            <span class="subject-name">${subject.name}</span>
            <div class="subject-item-actions">
                <button class="subject-rename-btn" data-index="${index}" title="Rename subject">✏️</button>
                <button class="subject-delete-btn" data-index="${index}" title="Delete subject">🗑️</button>
                <button class="subject-move-btn" data-dir="-1" data-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">&#9650;</button>
                <button class="subject-move-btn" data-dir="1" data-index="${index}" ${index === subjects.length - 1 ? 'disabled' : ''} aria-label="Move down">&#9660;</button>
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

    const newName = prompt('Enter new name for subject:', subject.name);
    if (newName && newName.trim()) {
        subject.name = newName.trim();
        saveSubjectsToStorage();
        renderSubjectList();
    }
}

function deleteSubject(index) {
    const subject = subjects[index];
    if (!subject) return;
    
    confirmMessageEl.textContent = `Delete "${subject.name}"? All data will be lost.`;
    confirmOkBtn.textContent = 'Delete';
    confirmModalEl.classList.add('visible');
    
    pendingDeleteCallback = () => {
        subjects.splice(index, 1);
        saveSubjectOrder();
        renderSubjectList();
        
        // If the deleted subject was selected, select another one
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
    
    // Reset form
    nameInput.value = '';
    iconInput.value = '📚';
    iconPreview.textContent = '📚';
    modal.classList.add('visible');
    nameInput.focus();
    
    // Update icon preview as user types
    const updatePreview = () => {
        iconPreview.textContent = iconInput.value || '📚';
    };
    iconInput.addEventListener('input', updatePreview);
    
    // Handle SVG file upload
    const handleFileUpload = () => {
        fileInput.click();
    };
    
    const handleFileSelected = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (event) => {
                // Store the SVG content and show preview
                const svgContent = event.target.result;
                iconPreview.innerHTML = svgContent;
                // Keep the SVG content for later use
                iconPreview.dataset.svgContent = svgContent;
            };
            reader.readAsText(file);
        }
    };
    
    uploadBtn.addEventListener('click', handleFileUpload);
    fileInput.addEventListener('change', handleFileSelected);
    
    const handleConfirm = () => {
        const name = nameInput.value.trim();
        let icon = iconInput.value.trim() || '📚';
        
        // Check if an SVG file was uploaded
        if (iconPreview.dataset.svgContent) {
            icon = iconPreview.dataset.svgContent;
        }
        
        if (!name) {
            nameInput.focus();
            return;
        }
        
        const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // Check if ID already exists
        if (subjects.some(s => s.id === id)) {
            alert('A subject with this name already exists. Please choose a different name.');
            return;
        }
        
        subjects.push({
            id: id,
            name: name,
            icon: icon
        });
        
        saveSubjectOrder();
        renderSubjectList();
        selectSubject(id);
        
        cleanup();
    };
    
    const handleCancel = () => {
        cleanup();
    };
    
    const cleanup = () => {
        modal.classList.remove('visible');
        iconInput.removeEventListener('input', updatePreview);
        uploadBtn.removeEventListener('click', handleFileUpload);
        fileInput.removeEventListener('change', handleFileSelected);
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        delete iconPreview.dataset.svgContent;
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    // Close on escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            handleCancel();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function saveSubjectOrder() {
    const order = subjects.map((subject) => subject.id);
    localStorage.setItem(SUBJECT_ORDER_KEY, JSON.stringify(order));
    // Also save the full subjects data (including names)
    saveSubjectsToStorage();
}

function saveSubjectsToStorage() {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
}

function loadSubjectsFromStorage() {
    // Load saved subjects data first
    const subjectsRaw = localStorage.getItem(SUBJECTS_KEY);
    let savedSubjects = null;
    if (subjectsRaw) {
        try {
            savedSubjects = JSON.parse(subjectsRaw);
        } catch {
            savedSubjects = null;
        }
    }
    
    // Load order
    const orderRaw = localStorage.getItem(SUBJECT_ORDER_KEY);
    if (orderRaw) {
        try {
            const order = JSON.parse(orderRaw);
            if (savedSubjects) {
                // Reorder saved subjects based on saved order
                const subjectMap = new Map(savedSubjects.map(s => [s.id, s]));
                const orderedSubjects = [];
                order.forEach(id => {
                    if (subjectMap.has(id)) {
                        orderedSubjects.push(subjectMap.get(id));
                    }
                });
                // Add any subjects not in the order
                savedSubjects.forEach(s => {
                    if (!order.includes(s.id)) {
                        orderedSubjects.push(s);
                    }
                });
                return orderedSubjects;
            } else {
                // No saved subjects, use order with default subjects
                const defaultMap = new Map(DEFAULT_SUBJECTS.map(s => [s.id, s]));
                const orderedSubjects = [];
                order.forEach(id => {
                    if (defaultMap.has(id)) {
                        orderedSubjects.push(defaultMap.get(id));
                    }
                });
                // Add any default subjects not in the order
                DEFAULT_SUBJECTS.forEach(s => {
                    if (!order.includes(s.id)) {
                        orderedSubjects.push(s);
                    }
                });
                return orderedSubjects;
            }
        } catch {
            // If order parsing fails, fall back to saved subjects or defaults
            return savedSubjects || [...DEFAULT_SUBJECTS];
        }
    }
    
    // No order saved, use saved subjects or defaults
    return savedSubjects || [...DEFAULT_SUBJECTS];
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
    console.log('Opening subject:', subject.id);
    currentSubject = subject;
    saveState();
    updateBackButton();

    if (currentSubjectTitleEl) {
        currentSubjectTitleEl.textContent = `${subject.icon} ${subject.name}`;
    }

    await loadPortionImages(subject.id);
    await loadWorksheets(subject.id);
    await loadPlan(subject.id);
    await loadTodos(subject.id);

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

function openTimer() {
    window.open(TIMER_URL, '_blank');
}

function openMotivation() {
    window.open(MOTIVATION_URL, '_blank');
}

function setupEventListeners() {
    const addSubjectBtn = document.getElementById('addSubjectBtn');
    if (addSubjectBtn) {
        addSubjectBtn.addEventListener('click', addSubject);
    }

    backBtn.addEventListener('click', closeSubjectView);
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
    togglePdfBtn.addEventListener('click', togglePdfSidebar);
    closeSidebarBtn.addEventListener('click', closePdfSidebar);
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
    sidebarOverlayEl.addEventListener('click', () => {
        closePdfSidebar();
        closePreview();
    });
    
    // Preview sidebar events
    closePreviewBtn.addEventListener('click', closePreview);
    fullscreenPreviewBtn.addEventListener('click', toggleFullscreenPreview);
    
    timerBtn.addEventListener('click', openTimer);
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
                        { sectionId: 'todoSection', contentId: 'todoList', type: 'todo' }
                    ];
                    const currentBlockIndex = 3; // todo is at index 3
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

        if (e.key === 'Tab') {
            e.preventDefault();
            if (document.activeElement === confirmCancelBtn) {
                confirmOkBtn.focus();
            } else {
                confirmCancelBtn.focus();
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // If confirm dialog is open, close it
            if (confirmModalEl.classList.contains('visible')) {
                confirmModalEl.classList.remove('visible');
                pendingDeleteCallback = null;
                return;
            }
            
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
    
    const contentId = blockType === 'portion' ? 'portionContent' : 'worksheetsList';
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

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

document.addEventListener('DOMContentLoaded', init);



