/**
 * ALED backend API (Express). Serves REST routes and static files; data under dataRoot.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const ALLOWED_ICON_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const ALLOWED_WORKSHEET_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
const ALLOWED_PORTION_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.mp4', '.webm', '.ogg', '.mov', '.avi',
  '.mp3', '.wav', '.flac', '.m4a', '.doc', '.docx'
]);
const ALLOWED_ALL_EXTENSIONS = new Set([...ALLOWED_PORTION_EXTENSIONS, '.md', '.txt', '.svg']);

const TEMPLATE_SUBJECTS = {
  cbse10: ['English', 'Maths', 'Science', 'Hindi', 'Kannada', 'SST'],
  cbse11: ['Physics', 'Chemistry', 'Maths', 'Biology', 'ComputerScience'],
  sat: ['Math', 'English'],
  custom: []
};

function loadData(dataRoot) {
  const p = getDataFile(dataRoot);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { currentExam: null, subjects: [], order: [], currentSubject: null, examOrder: [] };
  }
}

function saveData(dataRoot, data) {
  try {
    fs.writeFileSync(getDataFile(dataRoot), JSON.stringify(data), 'utf8');
  } catch (_) {}
}

function getDataDir(dataRoot) {
  return path.join(dataRoot, 'data');
}

function getDataFile(dataRoot) {
  return path.join(dataRoot, 'aled_data.json');
}

function getExamFolder(dataRoot) {
  const data = loadData(dataRoot);
  const saved = data.currentExam;
  const dataDir = getDataDir(dataRoot);
  if (saved && fs.existsSync(path.join(dataDir, saved))) {
    return saved;
  }
  if (!fs.existsSync(dataDir)) {
    return null;
  }
  const entries = fs.readdirSync(dataDir).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  for (const entry of entries) {
    const entryPath = path.join(dataDir, entry);
    try {
      if (!fs.statSync(entryPath).isDirectory()) continue;
      const subs = fs.readdirSync(entryPath);
      const hasSubfolders = subs.some((sub) => {
        try {
          return fs.statSync(path.join(entryPath, sub)).isDirectory();
        } catch {
          return false;
        }
      });
      if (hasSubfolders) return entry;
    } catch {
      continue;
    }
  }
  return null;
}

function saveCurrentExam(dataRoot, examName) {
  const data = loadData(dataRoot);
  data.currentExam = examName;
  saveData(dataRoot, data);
}

function getSubjectBaseDir(dataRoot, examFolder) {
  if (examFolder) {
    return path.join(getDataDir(dataRoot), examFolder);
  }
  return getDataDir(dataRoot);
}

function getSubjectUrlPath(examFolder) {
  if (examFolder) {
    return `data/${encodeURIComponent(examFolder)}`;
  }
  return 'data';
}

function sendJson(res, data, status = 200) {
  res.status(status).set('Access-Control-Allow-Origin', '*').json(data);
}

function getSubjectFolder(subject) {
  if (typeof subject !== 'string') return null;
  const sanitized = subject.replace(/[<>:"/\\|?*]/g, '_');
  return sanitized
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .replace(/\s/g, '');
}

function sanitizeFilename(name) {
  const base = path.basename((name || '').trim());
  if (!base) return '';
  const safe = Array.from(base)
    .filter((ch) => /[a-zA-Z0-9\-_. ]/.test(ch))
    .join('')
    .trim();
  return safe.replace(/\s+/g, '_');
}

function inferExtension(filename, mimeType) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) return ext;
  const mimeMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return mimeMap[(mimeType || '').toLowerCase()] || '.png';
}

function inferIconExtension(filename, mimeType) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ALLOWED_ICON_EXTENSIONS.has(ext)) return ext;
  const mimeMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg'
  };
  return mimeMap[(mimeType || '').toLowerCase()] || '.png';
}

function uniqueFilename(directory, preferredName, allowedExts) {
  let preferred = sanitizeFilename(preferredName);
  if (!preferred) {
    preferred = `file_${Date.now()}`;
  }
  let stem = path.parse(preferred).name;
  let ext = path.extname(preferred).toLowerCase();
  const allow = allowedExts || ALLOWED_IMAGE_EXTENSIONS;
  if (!allow.has(ext)) {
    ext = '.bin';
  }
  let candidate = `${stem}${ext}`;
  let index = 1;
  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `${stem}_${index}${ext}`;
    index += 1;
  }
  return candidate;
}

function readExamsConfig(dataRoot, writeExamsConfigFn) {
  const defaultConfig = { order: [], currentExam: null };
  const data = loadData(dataRoot);
  let order = data.examOrder;
  if (!Array.isArray(order)) order = [];
  const normalizedOrder = [];
  const seen = new Set();
  for (const examName of order) {
    if (typeof examName !== 'string') continue;
    if (seen.has(examName)) continue;
    normalizedOrder.push(examName);
    seen.add(examName);
  }
  let currentExam = data.currentExam;
  if (currentExam != null && typeof currentExam !== 'string') {
    currentExam = null;
  }
  if (normalizedOrder.length) {
    return { order: normalizedOrder, currentExam };
  }
  const legacyPath = path.join(getDataDir(dataRoot), 'exams.json');
  if (!fs.existsSync(legacyPath)) {
    return { order: normalizedOrder, currentExam };
  }
  let loaded;
  try {
    loaded = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
  } catch {
    return { order: normalizedOrder, currentExam };
  }
  if (!loaded || typeof loaded !== 'object') {
    return { order: normalizedOrder, currentExam };
  }
  let legacyOrder = loaded.order;
  if (!Array.isArray(legacyOrder)) {
    const legacyExams = loaded.exams;
    legacyOrder = Array.isArray(legacyExams) ? legacyExams : [];
  }
  const migratedOrder = [];
  const seenM = new Set();
  for (const examName of legacyOrder) {
    if (typeof examName !== 'string') continue;
    if (seenM.has(examName)) continue;
    migratedOrder.push(examName);
    seenM.add(examName);
  }
  if (migratedOrder.length) {
    writeExamsConfigFn({
      order: migratedOrder,
      currentExam: currentExam != null ? currentExam : loaded.currentExam
    });
    return {
      order: migratedOrder,
      currentExam: currentExam != null ? currentExam : loaded.currentExam
    };
  }
  return defaultConfig;
}

function writeExamsConfig(dataRoot, config) {
  const order = config.order || [];
  const normalizedOrder = [];
  const seen = new Set();
  if (Array.isArray(order)) {
    for (const examName of order) {
      if (typeof examName !== 'string') continue;
      if (seen.has(examName)) continue;
      normalizedOrder.push(examName);
      seen.add(examName);
    }
  }
  let currentExam = config.currentExam;
  if (currentExam != null && typeof currentExam !== 'string') {
    currentExam = null;
  }
  const data = loadData(dataRoot);
  data.examOrder = normalizedOrder;
  if (currentExam !== null && currentExam !== undefined) {
    data.currentExam = currentExam;
  }
  saveData(dataRoot, data);
}

function getAllExams(dataRoot) {
  const dataDir = getDataDir(dataRoot);
  if (!fs.existsSync(dataDir)) return [];
  const exams = [];
  const entries = fs.readdirSync(dataDir).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  for (const entry of entries) {
    const entryPath = path.join(dataDir, entry);
    try {
      if (!fs.statSync(entryPath).isDirectory()) continue;
      const subs = fs.readdirSync(entryPath);
      const hasSubfolders = subs.some((sub) => {
        try {
          return fs.statSync(path.join(entryPath, sub)).isDirectory();
        } catch {
          return false;
        }
      });
      if (hasSubfolders) exams.push(entry);
    } catch {
      continue;
    }
  }
  return exams;
}

function startServer({ dataRoot, staticRoot }) {
  let examFolder = getExamFolder(dataRoot);

  const writeCfg = (config) => writeExamsConfig(dataRoot, config);
  const readCfg = () => readExamsConfig(dataRoot, writeCfg);

  function getOrderedExams() {
    const allExams = getAllExams(dataRoot);
    const config = readCfg();
    const savedOrder = config.order || [];
    const ordered = [];
    const seen = new Set();
    const available = new Set(allExams);
    for (const examName of savedOrder) {
      if (!available.has(examName) || seen.has(examName)) continue;
      ordered.push(examName);
      seen.add(examName);
    }
    for (const examName of allExams) {
      if (!seen.has(examName)) {
        ordered.push(examName);
        seen.add(examName);
      }
    }
    let currentExam = config.currentExam;
    if (currentExam != null && !available.has(currentExam)) {
      currentExam = null;
    }
    if (JSON.stringify(ordered) !== JSON.stringify(savedOrder) || currentExam !== config.currentExam) {
      writeCfg({ order: ordered, currentExam });
    }
    return ordered;
  }

  function getSubjectDataDir(subject) {
    const folderName = getSubjectFolder(subject);
    if (!folderName) return null;
    return path.join(getSubjectBaseDir(dataRoot, examFolder), folderName);
  }

  function getPortionDir(subject) {
    const dataDir = getSubjectDataDir(subject);
    if (!dataDir) return null;
    return path.join(dataDir, 'portion');
  }

  function getWorksheetsDir(subject) {
    const dataDir = getSubjectDataDir(subject);
    if (!dataDir) return null;
    return path.join(dataDir, 'worksheets');
  }

  function getPlanPath(subject) {
    const dataDir = getSubjectDataDir(subject);
    if (!dataDir) return null;
    return path.join(dataDir, 'plan', 'plan.txt');
  }

  function getGlobalPortionsDir() {
    return path.join(getSubjectBaseDir(dataRoot, examFolder), 'portions');
  }

  function getPortionsOrderPath() {
    return path.join(getGlobalPortionsDir(), 'order.json');
  }

  function getPortionOrderPath(subject) {
    const portionDir = getPortionDir(subject);
    if (!portionDir) return null;
    return path.join(portionDir, 'order.json');
  }

  function readOrder(subject) {
    const orderPath = getPortionOrderPath(subject);
    if (!orderPath || !fs.existsSync(orderPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
      if (Array.isArray(data)) return data.map(String);
    } catch {
      /* ignore */
    }
    return [];
  }

  function writeOrder(subject, order) {
    const orderPath = getPortionOrderPath(subject);
    if (!orderPath) return;
    fs.mkdirSync(path.dirname(orderPath), { recursive: true });
    fs.writeFileSync(orderPath, JSON.stringify(order, null, 2), 'utf8');
  }

  function listPortionImages(subject) {
    const folderName = getSubjectFolder(subject);
    const portionDir = getPortionDir(subject);
    if (!folderName || !portionDir) return [];
    if (!fs.existsSync(portionDir)) return [];
    const files = [];
    for (const filename of fs.readdirSync(portionDir)) {
      const p = path.join(portionDir, filename);
      const ext = path.extname(filename).toLowerCase();
      if (fs.statSync(p).isFile() && ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        files.push(filename);
      }
    }
    let order = readOrder(subject);
    const existing = new Set(files);
    const ordered = order.filter((name) => existing.has(name));
    const remaining = files.filter((name) => !ordered.includes(name)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const finalNames = ordered.concat(remaining);
    if (JSON.stringify(finalNames) !== JSON.stringify(order)) {
      writeOrder(subject, finalNames);
    }
    const basePath = getSubjectUrlPath(examFolder);
    return finalNames.map((name) => ({
      name,
      url: `/${basePath}/${encodeURIComponent(folderName)}/portion/${encodeURIComponent(name)}`
    }));
  }

  function readPortionsOrder() {
    const orderPath = getPortionsOrderPath();
    if (!orderPath || !fs.existsSync(orderPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
      if (Array.isArray(data)) return data.map(String);
    } catch {
      /* ignore */
    }
    return [];
  }

  function writePortionsOrder(order) {
    const orderPath = getPortionsOrderPath();
    if (!orderPath) return;
    fs.mkdirSync(path.dirname(orderPath), { recursive: true });
    fs.writeFileSync(orderPath, JSON.stringify(order, null, 2), 'utf8');
  }

  function getLearningMaterialsDir(subject) {
    const dataDir = getSubjectDataDir(subject);
    if (!dataDir) return null;
    return path.join(dataDir, 'learning_materials');
  }

  function getMimeTypeForFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    const typeMap = {
      '.mp4': 'MP4',
      '.webm': 'WEBM',
      '.mov': 'MOV',
      '.mp3': 'MP3',
      '.wav': 'WAV',
      '.pdf': 'PDF',
      '.png': 'PNG',
      '.jpg': 'JPG',
      '.jpeg': 'JPEG',
      '.gif': 'GIF',
      '.md': 'MD',
      '.txt': 'TXT'
    };
    return typeMap[ext] || (ext ? ext.slice(1).toUpperCase() : 'FILE');
  }

  function getTodosPath(subject) {
    const folderName = getSubjectFolder(subject);
    if (!folderName) return null;
    return path.join(getSubjectBaseDir(dataRoot, examFolder), folderName, 'todos.json');
  }

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/subjects', (req, res) => {
    const subjects = [];
    const examPath = getSubjectBaseDir(dataRoot, examFolder);
    const baseUrlPath = getSubjectUrlPath(examFolder);
    if (fs.existsSync(examPath)) {
      for (const sub of fs.readdirSync(examPath)) {
        const subPath = path.join(examPath, sub);
        try {
          if (!fs.statSync(subPath).isDirectory() || sub === 'portions' || sub === 'quotes.js') continue;
          let iconUrl = null;
          for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']) {
            const potentialIcon = path.join(subPath, `icon${ext}`);
            if (fs.existsSync(potentialIcon)) {
              iconUrl = `/${baseUrlPath}/${encodeURIComponent(sub)}/icon${ext}`;
              break;
            }
          }
          subjects.push({ id: sub, name: sub, icon: iconUrl });
        } catch {
          continue;
        }
      }
    }
    sendJson(res, subjects);
  });

  app.get('/api/subjects-data', (req, res) => {
    const data = loadData(dataRoot);
    sendJson(res, { subjects: data.subjects || [], order: data.order || [] });
  });

  app.post('/api/subjects-data', (req, res) => {
    const data = loadData(dataRoot);
    data.subjects = req.body.subjects || [];
    data.order = req.body.order || [];
    saveData(dataRoot, data);
    sendJson(res, { success: true });
  });

  app.get('/api/state', (req, res) => {
    const data = loadData(dataRoot);
    sendJson(res, { currentSubject: data.currentSubject });
  });

  app.post('/api/state/save', (req, res) => {
    const data = loadData(dataRoot);
    data.currentSubject = req.body.currentSubject;
    saveData(dataRoot, data);
    sendJson(res, { success: true });
  });

  app.get('/api/exam/current', (req, res) => {
    sendJson(res, { currentExam: examFolder });
  });

  app.get('/api/exams', (req, res) => {
    const allExams = getOrderedExams();
    const examsData = [];
    for (const exam of allExams) {
      const subjects = [];
      const examPath = path.join(getDataDir(dataRoot), exam);
      if (fs.existsSync(examPath)) {
        for (const sub of fs.readdirSync(examPath)) {
          const subPath = path.join(examPath, sub);
          try {
            if (fs.statSync(subPath).isDirectory() && sub !== 'portions' && sub !== 'quotes.js') {
              subjects.push(sub);
            }
          } catch {
            continue;
          }
        }
      }
      examsData.push({ name: exam, subjects });
    }
    sendJson(res, { exams: examsData, currentExam: examFolder });
  });

  app.get('/api/worksheets', (req, res) => {
    const subject = (req.query.subject || '').toString();
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const folderPath = getWorksheetsDir(subject);
    const files = [];
    if (folderPath && fs.existsSync(folderPath)) {
      for (const filename of fs.readdirSync(folderPath)) {
        const filepath = path.join(folderPath, filename);
        try {
          if (!fs.statSync(filepath).isFile()) continue;
          const ext = path.extname(filename).toLowerCase();
          if (ALLOWED_WORKSHEET_EXTENSIONS.has(ext)) {
            files.push({
              name: filename,
              file: `${getSubjectUrlPath(examFolder)}/${folderName}/worksheets/${filename}`,
              type: ext.slice(1)
            });
          }
        } catch {
          continue;
        }
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    sendJson(res, files);
  });

  app.get('/api/plan', (req, res) => {
    const subject = (req.query.subject || '').toString();
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const planPath = getPlanPath(subject);
    if (planPath && fs.existsSync(planPath)) {
      sendJson(res, { content: fs.readFileSync(planPath, 'utf8') });
    } else {
      sendJson(res, { content: '' });
    }
  });

  app.get('/api/portion-images', (req, res) => {
    const subject = (req.query.subject || '').toString();
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    sendJson(res, listPortionImages(subject));
  });

  app.get('/api/todos', (req, res) => {
    const subject = (req.query.subject || '').toString();
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const todosPath = getTodosPath(subject);
    if (todosPath && fs.existsSync(todosPath)) {
      try {
        const todos = JSON.parse(fs.readFileSync(todosPath, 'utf8'));
        return sendJson(res, { todos });
      } catch {
        return sendJson(res, { todos: [] });
      }
    }
    sendJson(res, { todos: [] });
  });

  app.get('/api/portions', (req, res) => {
    const portionsDir = getGlobalPortionsDir();
    if (!fs.existsSync(portionsDir)) {
      return sendJson(res, []);
    }
    let order = readPortionsOrder();
    const files = [];
    for (const filename of fs.readdirSync(portionsDir)) {
      const filepath = path.join(portionsDir, filename);
      try {
        if (!fs.statSync(filepath).isFile()) continue;
        const ext = path.extname(filename).toLowerCase();
        if (ALLOWED_PORTION_EXTENSIONS.has(ext)) {
          files.push(filename);
        }
      } catch {
        continue;
      }
    }
    const existing = new Set(files);
    const ordered = order.filter((name) => existing.has(name));
    const remaining = files.filter((name) => !ordered.includes(name)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const finalNames = ordered.concat(remaining);
    if (JSON.stringify(finalNames) !== JSON.stringify(order)) {
      writePortionsOrder(finalNames);
    }
    const basePath = getSubjectUrlPath(examFolder);
    const result = finalNames.map((name) => {
      const ext = path.extname(name).slice(1);
      return {
        name,
        url: `/${basePath}/portions/${encodeURIComponent(name)}`,
        type: ext
      };
    });
    sendJson(res, result);
  });

  app.get('/api/learning-materials', (req, res) => {
    const subject = (req.query.subject || '').toString();
    const folderPath = getLearningMaterialsDir(subject);
    if (!folderPath || !fs.existsSync(folderPath)) {
      return sendJson(res, []);
    }
    const materials = [];
    const folderName = getSubjectFolder(subject);
    for (const filename of fs.readdirSync(folderPath)) {
      const p = path.join(folderPath, filename);
      try {
        if (!fs.statSync(p).isFile()) continue;
        let name = filename;
        let url = `${getSubjectUrlPath(examFolder)}/${folderName}/learning_materials/${filename}`;
        let fileType = getMimeTypeForFile(filename);
        let isLink = false;
        if (filename.endsWith('.json')) {
          try {
            const linkData = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (linkData.isLink) {
              url = linkData.url || '';
              name = filename.slice(0, -5);
              fileType = 'Link';
              isLink = true;
            }
          } catch {
            /* ignore */
          }
        }
        materials.push({ name, url, type: fileType, isLink });
      } catch {
        continue;
      }
    }
    sendJson(res, materials);
  });

  app.post('/api/subjects', (req, res) => {
    const subject = req.body.subject;
    if (!subject) {
      return sendJson(res, { error: 'Subject name required' }, 400);
    }
    const subjectDir = getSubjectDataDir(subject);
    if (!subjectDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    try {
      fs.mkdirSync(subjectDir, { recursive: true });
      const portionDir = getPortionDir(subject);
      const worksheetsDir = getWorksheetsDir(subject);
      const lmDir = getLearningMaterialsDir(subject);
      if (portionDir) fs.mkdirSync(portionDir, { recursive: true });
      if (worksheetsDir) fs.mkdirSync(worksheetsDir, { recursive: true });
      if (lmDir) fs.mkdirSync(lmDir, { recursive: true });
      const planPath = getPlanPath(subject);
      if (planPath) {
        fs.mkdirSync(path.dirname(planPath), { recursive: true });
      }
      sendJson(res, { success: true, folder: path.basename(subjectDir) });
    } catch (e) {
      sendJson(res, { error: `Failed to create subject folder: ${e.message}` }, 500);
    }
  });

  app.delete('/api/subjects', (req, res) => {
    const subject = req.body.subject;
    const subjectName = req.body.subjectName;
    if (!subject && !subjectName) {
      return sendJson(res, { error: 'Subject name required' }, 400);
    }
    const candidates = [];
    if (typeof subject === 'string' && subject.trim()) candidates.push(subject.trim());
    if (typeof subjectName === 'string' && subjectName.trim() && !candidates.includes(subjectName.trim())) {
      candidates.push(subjectName.trim());
    }
    let deletedAny = false;
    for (const candidate of candidates) {
      const subjectDir = getSubjectDataDir(candidate);
      if (!subjectDir || !fs.existsSync(subjectDir)) continue;
      try {
        fs.rmSync(subjectDir, { recursive: true, force: true });
        deletedAny = true;
      } catch (e) {
        return sendJson(res, { error: `Failed to delete folder: ${e.message}` }, 500);
      }
    }
    if (deletedAny) {
      sendJson(res, { success: true, message: 'Deleted subject folder' });
    } else {
      sendJson(res, { success: true, message: 'Folder already deleted or does not exist' });
    }
  });

  app.post('/api/subject-icon/upload', (req, res) => {
    const subject = req.body.subject || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    let iconBase64 = req.body.icon_base64 || '';
    if (typeof iconBase64 !== 'string' || !iconBase64.trim()) {
      return sendJson(res, { error: 'icon_base64 is required' }, 400);
    }
    let mimeType = req.body.mime_type || '';
    let raw = iconBase64.trim();
    if (raw.toLowerCase().startsWith('data:') && raw.includes(',')) {
      const [header, rawData] = raw.split(',');
      raw = rawData;
      const semi = header.indexOf(';');
      mimeType = semi > 5 ? header.slice(5, semi) : header.slice(5);
    }
    let iconBytes;
    try {
      iconBytes = Buffer.from(raw, 'base64');
    } catch {
      return sendJson(res, { error: 'Invalid base64 icon data' }, 400);
    }
    if (iconBytes.length > 2 * 1024 * 1024) {
      return sendJson(res, { error: 'Icon too large (max 2MB)' }, 400);
    }
    const subjectDir = getSubjectDataDir(subject);
    if (!subjectDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    fs.mkdirSync(subjectDir, { recursive: true });
    const originalName = req.body.filename || '';
    const ext = inferIconExtension(originalName, mimeType);
    if (!ALLOWED_ICON_EXTENSIONS.has(ext)) {
      return sendJson(res, { error: 'Unsupported icon format' }, 400);
    }
    for (const existing of fs.readdirSync(subjectDir)) {
      if (existing.startsWith('icon') && ALLOWED_ICON_EXTENSIONS.has(path.extname(existing).toLowerCase())) {
        const existingPath = path.join(subjectDir, existing);
        if (fs.statSync(existingPath).isFile()) {
          try {
            fs.unlinkSync(existingPath);
          } catch {
            /* ignore */
          }
        }
      }
    }
    const finalName = `icon${ext}`;
    const finalPath = path.join(subjectDir, finalName);
    fs.writeFileSync(finalPath, iconBytes);
    const url = `/${getSubjectUrlPath(examFolder)}/${encodeURIComponent(folderName)}/${encodeURIComponent(finalName)}`;
    sendJson(res, { success: true, name: finalName, url });
  });

  app.post('/api/plan', (req, res) => {
    const subject = req.body.subject || '';
    const content = req.body.content || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const planPath = getPlanPath(subject);
    if (!planPath) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, content, 'utf8');
    sendJson(res, { success: true, message: 'Plan saved!' });
  });

  app.post('/api/todos', (req, res) => {
    const subject = req.body.subject || '';
    const todos = req.body.todos || [];
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const todosPath = getTodosPath(subject);
    if (!todosPath) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const todosDir = path.dirname(todosPath);
    if (todosDir) {
      fs.mkdirSync(todosDir, { recursive: true });
    }
    fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2), 'utf8');
    sendJson(res, { success: true, message: 'Todos saved!' });
  });

  app.post('/api/portion-images', (req, res) => {
    const subject = req.body.subject || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    let imageBase64 = req.body.image_base64 || '';
    if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      return sendJson(res, { error: 'image_base64 is required' }, 400);
    }
    let raw = imageBase64.trim();
    if (raw.includes(',') && raw.toLowerCase().startsWith('data:')) {
      raw = raw.split(',', 2)[1];
    }
    let imageBytes;
    try {
      imageBytes = Buffer.from(raw, 'base64');
    } catch {
      return sendJson(res, { error: 'Invalid base64 image data' }, 400);
    }
    if (imageBytes.length > 12 * 1024 * 1024) {
      return sendJson(res, { error: 'Image too large (max 12MB)' }, 400);
    }
    const portionDir = getPortionDir(subject);
    if (!portionDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    fs.mkdirSync(portionDir, { recursive: true });
    const originalName = req.body.filename || '';
    const mimeType = req.body.mime_type || '';
    const ext = inferExtension(originalName, mimeType);
    const preferredStem = path.parse(sanitizeFilename(originalName)).name;
    const preferredName = `${preferredStem || 'portion'}${ext}`;
    const finalName = uniqueFilename(portionDir, preferredName, ALLOWED_IMAGE_EXTENSIONS);
    const finalPath = path.join(portionDir, finalName);
    fs.writeFileSync(finalPath, imageBytes);
    let currentOrder = readOrder(subject);
    if (!currentOrder.includes(finalName)) {
      currentOrder = currentOrder.concat(finalName);
    }
    writeOrder(subject, currentOrder);
    sendJson(res, { success: true, name: finalName });
  });

  app.post('/api/portion-images/reorder', (req, res) => {
    const subject = req.body.subject || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const order = req.body.order;
    if (!Array.isArray(order)) {
      return sendJson(res, { error: 'order must be a list' }, 400);
    }
    const existing = listPortionImages(subject).map((item) => item.name);
    const existingSet = new Set(existing);
    const normalized = [];
    for (const item of order) {
      const name = sanitizeFilename(String(item));
      if (existingSet.has(name) && !normalized.includes(name)) {
        normalized.push(name);
      }
    }
    for (const name of existing) {
      if (!normalized.includes(name)) {
        normalized.push(name);
      }
    }
    writeOrder(subject, normalized);
    sendJson(res, { success: true });
  });

  app.post('/api/portion-images/delete', (req, res) => {
    const subject = req.body.subject || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const filename = sanitizeFilename(req.body.filename || '');
    if (!filename) {
      return sendJson(res, { error: 'filename is required' }, 400);
    }
    const portionDir = getPortionDir(subject);
    if (!portionDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const filePath = path.join(portionDir, filename);
    if (!fs.existsSync(filePath)) {
      return sendJson(res, { error: 'File not found' }, 404);
    }
    try {
      fs.unlinkSync(filePath);
      const currentOrder = readOrder(subject).filter((name) => name !== filename);
      writeOrder(subject, currentOrder);
      sendJson(res, { success: true });
    } catch (e) {
      sendJson(res, { error: `Delete failed: ${e.message}` }, 500);
    }
  });

  app.post('/api/worksheets/upload', (req, res) => {
    const subject = req.body.subject || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    let fileBase64 = req.body.file_base64 || '';
    if (typeof fileBase64 !== 'string' || !fileBase64.trim()) {
      return sendJson(res, { error: 'file_base64 is required' }, 400);
    }
    let raw = fileBase64.trim();
    if (raw.includes(',') && raw.toLowerCase().startsWith('data:')) {
      raw = raw.split(',', 2)[1];
    }
    let fileBytes;
    try {
      fileBytes = Buffer.from(raw, 'base64');
    } catch {
      return sendJson(res, { error: 'Invalid base64 data' }, 400);
    }
    if (fileBytes.length > 25 * 1024 * 1024) {
      return sendJson(res, { error: 'File too large (max 25MB)' }, 400);
    }
    const worksheetsDir = getWorksheetsDir(subject);
    if (!worksheetsDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    fs.mkdirSync(worksheetsDir, { recursive: true });
    const originalName = req.body.filename || '';
    let ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_WORKSHEET_EXTENSIONS.has(ext)) {
      ext = '.pdf';
    }
    const preferredStem = path.parse(sanitizeFilename(originalName)).name;
    const preferredName = `${preferredStem || 'worksheet'}${ext}`;
    const finalName = uniqueFilename(worksheetsDir, preferredName, ALLOWED_WORKSHEET_EXTENSIONS);
    const finalPath = path.join(worksheetsDir, finalName);
    fs.writeFileSync(finalPath, fileBytes);
    sendJson(res, { success: true, name: finalName });
  });

  app.post('/api/worksheets/delete', (req, res) => {
    const subject = req.body.subject || '';
    const filename = req.body.filename || '';
    const folderName = getSubjectFolder(subject);
    if (!folderName) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    if (!filename) {
      return sendJson(res, { error: 'filename is required' }, 400);
    }
    const worksheetsDir = getWorksheetsDir(subject);
    if (!worksheetsDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    const filePath = path.join(worksheetsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        sendJson(res, { success: true });
      } catch (e) {
        sendJson(res, { error: `Delete failed: ${e.message}` }, 500);
      }
    } else {
      sendJson(res, { error: 'File not found' }, 404);
    }
  });

  app.post('/api/portions/upload', (req, res) => {
    let fileBase64 = req.body.file_base64 || '';
    if (typeof fileBase64 !== 'string' || !fileBase64.trim()) {
      return sendJson(res, { error: 'file_base64 is required' }, 400);
    }
    let raw = fileBase64.trim();
    if (raw.includes(',') && raw.toLowerCase().startsWith('data:')) {
      raw = raw.split(',', 2)[1];
    }
    let fileBytes;
    try {
      fileBytes = Buffer.from(raw, 'base64');
    } catch {
      return sendJson(res, { error: 'Invalid base64 data' }, 400);
    }
    if (fileBytes.length > 25 * 1024 * 1024) {
      return sendJson(res, { error: 'File too large (max 25MB)' }, 400);
    }
    const portionsDir = getGlobalPortionsDir();
    fs.mkdirSync(portionsDir, { recursive: true });
    const originalName = req.body.filename || '';
    let ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_PORTION_EXTENSIONS.has(ext)) {
      ext = '.pdf';
    }
    const preferredStem = path.parse(sanitizeFilename(originalName)).name;
    const preferredName = `${preferredStem || 'portion'}${ext}`;
    const finalName = uniqueFilename(portionsDir, preferredName, ALLOWED_PORTION_EXTENSIONS);
    const finalPath = path.join(portionsDir, finalName);
    fs.writeFileSync(finalPath, fileBytes);
    let currentOrder = readPortionsOrder();
    if (!currentOrder.includes(finalName)) {
      currentOrder = currentOrder.concat(finalName);
    }
    writePortionsOrder(currentOrder);
    sendJson(res, { success: true, name: finalName });
  });

  app.post('/api/portions/reorder', (req, res) => {
    const order = req.body.order;
    if (!Array.isArray(order)) {
      return sendJson(res, { error: 'order must be a list' }, 400);
    }
    const portionsDir = getGlobalPortionsDir();
    if (!fs.existsSync(portionsDir)) {
      return sendJson(res, { success: true });
    }
    const files = [];
    for (const filename of fs.readdirSync(portionsDir)) {
      const filepath = path.join(portionsDir, filename);
      try {
        if (!fs.statSync(filepath).isFile()) continue;
        const ext = path.extname(filename).toLowerCase();
        if (ALLOWED_PORTION_EXTENSIONS.has(ext)) {
          files.push(filename);
        }
      } catch {
        continue;
      }
    }
    const existing = new Set(files);
    const normalized = [];
    for (const item of order) {
      const name = sanitizeFilename(String(item));
      if (existing.has(name) && !normalized.includes(name)) {
        normalized.push(name);
      }
    }
    for (const name of files) {
      if (!normalized.includes(name)) {
        normalized.push(name);
      }
    }
    writePortionsOrder(normalized);
    sendJson(res, { success: true });
  });

  app.post('/api/portions/delete', (req, res) => {
    const filename = req.body.filename || '';
    if (!filename) {
      return sendJson(res, { error: 'filename is required' }, 400);
    }
    const portionsDir = getGlobalPortionsDir();
    const filePath = path.join(portionsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        let currentOrder = readPortionsOrder();
        const idx = currentOrder.indexOf(filename);
        if (idx !== -1) {
          currentOrder = currentOrder.slice(0, idx).concat(currentOrder.slice(idx + 1));
        }
        writePortionsOrder(currentOrder);
        sendJson(res, { success: true });
      } catch (e) {
        sendJson(res, { error: `Delete failed: ${e.message}` }, 500);
      }
    } else {
      sendJson(res, { error: 'File not found' }, 404);
    }
  });

  function handleUploadLearningMaterial(req, res) {
    const subject = req.body.subject;
    const filename = req.body.filename;
    const url = req.body.url;
    const isLink = req.body.isLink || false;
    const mimeType = req.body.mime_type || '';
    const fileBase64 = req.body.file_base64;

    if (!subject || !filename) {
      return sendJson(res, { error: 'Missing required fields' }, 400);
    }
    const materialsDir = getLearningMaterialsDir(subject);
    if (!materialsDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    fs.mkdirSync(materialsDir, { recursive: true });

    if (isLink && url) {
      const linkData = { url, isLink: true };
      const finalName = `${filename}.json`;
      const finalPath = path.join(materialsDir, finalName);
      fs.writeFileSync(finalPath, JSON.stringify(linkData), 'utf8');
      return sendJson(res, { success: true, name: filename, url, isLink: true });
    }

    if (!fileBase64) {
      return sendJson(res, { error: 'Missing file data' }, 400);
    }
    let fileData;
    try {
      fileData = Buffer.from(fileBase64, 'base64');
    } catch {
      return sendJson(res, { error: 'Invalid file data' }, 400);
    }
    const ext = path.extname(filename).toLowerCase();
    const finalName = uniqueFilename(materialsDir, filename, ALLOWED_ALL_EXTENSIONS);
    const finalPath = path.join(materialsDir, finalName);
    fs.writeFileSync(finalPath, fileData);
    const folderName = getSubjectFolder(subject);
    sendJson(res, {
      success: true,
      name: finalName,
      url: `${getSubjectUrlPath(examFolder)}/${folderName}/learning_materials/${finalName}`
    });
  }

  app.post('/api/learning-materials/upload', handleUploadLearningMaterial);
  app.post('/api/learning-materials', handleUploadLearningMaterial);

  app.post('/api/learning-materials/delete', (req, res) => {
    const subject = req.body.subject;
    const filename = req.body.filename;
    if (!subject || !filename) {
      return sendJson(res, { error: 'Missing required fields' }, 400);
    }
    const materialsDir = getLearningMaterialsDir(subject);
    if (!materialsDir) {
      return sendJson(res, { error: 'Invalid subject' }, 400);
    }
    let filePath = path.join(materialsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return sendJson(res, { success: true });
    }
    const jsonPath = path.join(materialsDir, `${filename}.json`);
    if (fs.existsSync(jsonPath)) {
      fs.unlinkSync(jsonPath);
      return sendJson(res, { success: true });
    }
    sendJson(res, { error: 'File not found' }, 404);
  });

  app.post('/api/exams', (req, res) => {
    const examName = (req.body.name || '').trim();
    const template = req.body.template || 'custom';
    if (!examName) {
      return sendJson(res, { error: 'Exam name required' }, 400);
    }
    const sanitized = examName.replace(/[<>:"/\\|?*]/g, '_');
    const examFolderName = sanitized;
    const examPath = path.join(getDataDir(dataRoot), examFolderName);
    if (fs.existsSync(examPath)) {
      return sendJson(res, { error: 'Exam already exists' }, 400);
    }
    try {
      fs.mkdirSync(examPath, { recursive: true });
      const subjects = TEMPLATE_SUBJECTS[template] || TEMPLATE_SUBJECTS.custom;
      for (const s of subjects) {
        const subjectPath = path.join(examPath, s);
        fs.mkdirSync(path.join(subjectPath, 'portion'), { recursive: true });
        fs.mkdirSync(path.join(subjectPath, 'plan'), { recursive: true });
        fs.mkdirSync(path.join(subjectPath, 'worksheets'), { recursive: true });
        fs.mkdirSync(path.join(subjectPath, 'learning_materials'), { recursive: true });
      }
      examFolder = examFolderName;
      saveCurrentExam(dataRoot, examFolderName);
      const config = readCfg();
      const order = config.order.filter((name) => name !== examFolderName).concat(examFolderName);
      writeCfg({ order, currentExam: examFolderName });
      sendJson(res, { success: true, exam: examFolderName, subjects });
    } catch (e) {
      sendJson(res, { error: `Failed to create exam: ${e.message}` }, 500);
    }
  });

  app.post('/api/exams/reorder', (req, res) => {
    const order = req.body.order;
    if (!Array.isArray(order)) {
      return sendJson(res, { error: 'order must be a list' }, 400);
    }
    const allExams = getAllExams(dataRoot);
    const available = new Set(allExams);
    const normalized = [];
    const seen = new Set();
    for (const item of order) {
      if (typeof item !== 'string') continue;
      if (!available.has(item) || seen.has(item)) continue;
      normalized.push(item);
      seen.add(item);
    }
    for (const examName of allExams) {
      if (!seen.has(examName)) {
        normalized.push(examName);
        seen.add(examName);
      }
    }
    const config = readCfg();
    config.order = normalized;
    writeCfg(config);
    sendJson(res, { success: true, order: normalized });
  });

  app.post('/api/exam/rename', (req, res) => {
    const oldName = (req.body.oldName || '').trim();
    const newName = (req.body.newName || '').trim();
    if (!oldName || !newName) {
      return sendJson(res, { error: 'Old and new name required' }, 400);
    }
    const sanitized = newName.replace(/[<>:"/\\|?*]/g, '_');
    const newFolder = sanitized;
    const oldPath = path.join(getDataDir(dataRoot), oldName);
    const newPath = path.join(getDataDir(dataRoot), newFolder);
    if (!fs.existsSync(oldPath)) {
      return sendJson(res, { error: 'Exam not found' }, 404);
    }
    if (fs.existsSync(newPath)) {
      return sendJson(res, { error: 'Exam name already exists' }, 400);
    }
    try {
      fs.renameSync(oldPath, newPath);
      if (examFolder === oldName) {
        examFolder = newFolder;
        saveCurrentExam(dataRoot, newFolder);
      }
      const config = readCfg();
      const updatedOrder = config.order.map((n) => (n === oldName ? newFolder : n));
      if (!updatedOrder.includes(newFolder)) {
        updatedOrder.push(newFolder);
      }
      if (config.currentExam === oldName) {
        config.currentExam = newFolder;
      }
      config.order = updatedOrder;
      writeCfg(config);
      sendJson(res, { success: true, newName: newFolder });
    } catch (e) {
      sendJson(res, { error: `Failed to rename exam: ${e.message}` }, 500);
    }
  });

  app.post('/api/exam/set-current', (req, res) => {
    const examName = (req.body.exam || '').trim();
    if (!examName) {
      return sendJson(res, { error: 'Exam name required' }, 400);
    }
    const examPath = path.join(getDataDir(dataRoot), examName);
    if (!fs.existsSync(examPath)) {
      return sendJson(res, { error: 'Exam not found' }, 404);
    }
    examFolder = examName;
    saveCurrentExam(dataRoot, examName);
    const config = readCfg();
    const order = config.order.filter((name) => name !== examName).concat(examName);
    writeCfg({ order, currentExam: examName });
    sendJson(res, { success: true, currentExam: examName });
  });

  app.delete('/api/exam', (req, res) => {
    const examName = (req.body.exam || '').trim();
    if (!examName) {
      return sendJson(res, { error: 'Exam name required' }, 400);
    }
    const examPath = path.join(getDataDir(dataRoot), examName);
    if (!fs.existsSync(examPath)) {
      return sendJson(res, { error: 'Exam not found' }, 404);
    }
    try {
      fs.rmSync(examPath, { recursive: true, force: true });
      const config = readCfg();
      let order = config.order.filter((name) => name !== examName);
      const remainingExams = getAllExams(dataRoot);
      const available = new Set(remainingExams);
      order = order.filter((name) => available.has(name));
      for (const name of remainingExams) {
        if (!order.includes(name)) {
          order.push(name);
        }
      }
      if (examFolder === examName) {
        examFolder = order[0] || null;
      } else if (examFolder && !available.has(examFolder)) {
        examFolder = order[0] || null;
      }
      saveCurrentExam(dataRoot, examFolder);
      config.order = order;
      config.currentExam = examFolder;
      writeCfg(config);
      sendJson(res, { success: true });
    } catch (e) {
      sendJson(res, { error: `Failed to delete exam: ${e.message}` }, 500);
    }
  });

  app.use('/data', express.static(path.join(dataRoot, 'data')));
  app.use(express.static(staticRoot));
  if (path.resolve(dataRoot) !== path.resolve(staticRoot)) {
    app.use(express.static(dataRoot));
  }

  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
    server.on('error', reject);
  });
}

module.exports = { startServer };
