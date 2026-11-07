import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';
import {
  generateApostilaPdf,
  generatePdfFromTextFile,
} from './sampleGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DEFAULT_HIGHLIGHTERS = [
  { id: 'hl-1', hex: '#FDE047', tag: 'Importante' },
  { id: 'hl-2', hex: '#D8B4FE', tag: 'Fórmula' },
  { id: 'hl-3', hex: '#F9A8D4', tag: 'Cai na prova' },
  { id: 'hl-4', hex: '#86EFAC', tag: 'Decorar' },
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      seeded: false,
      documents: [],
      annotations: {},
      settings: {
        lastActiveDocId: null,
        customHighlighters: DEFAULT_HIGHLIGHTERS,
      },
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!parsed.settings) {
      parsed.settings = {
        lastActiveDocId: parsed.documents?.[0]?.id || null,
        customHighlighters: DEFAULT_HIGHLIGHTERS,
      };
    }
    if (!Array.isArray(parsed.settings.customHighlighters)) {
      parsed.settings.customHighlighters = DEFAULT_HIGHLIGHTERS;
    }
    return parsed;
  } catch (err) {
    console.error('Erro ao ler banco de dados JSON:', err);
    return {
      seeded: true,
      documents: [],
      annotations: {},
      settings: {
        lastActiveDocId: null,
        customHighlighters: DEFAULT_HIGHLIGHTERS,
      },
    };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

async function seedInitialData() {
  const db = loadDb();
  // Only seed once on first creation; if user deletes all PDFs, keep it empty!
  if (db.seeded || db.documents.length > 0) {
    db.seeded = true;
    saveDb(db);
    return;
  }

  const apostilaFilename = 'sample-apostila-fisiologia.pdf';
  const apostilaPath = path.join(UPLOADS_DIR, apostilaFilename);
  await generateApostilaPdf(apostilaPath);

  const now = new Date().toISOString();
  const docApostila = {
    id: 'doc-apostila-01',
    title: 'Apostila Exemplo (Você pode apagar)',
    filename: apostilaFilename,
    pageCount: 3,
    currentPage: 1,
    zoom: 1.15,
    createdAt: now,
    updatedAt: now,
  };

  db.seeded = true;
  db.documents = [docApostila];
  db.settings = {
    lastActiveDocId: docApostila.id,
    customHighlighters: DEFAULT_HIGHLIGHTERS,
  };
  db.annotations = {
    'doc-apostila-01': [],
  };

  saveDb(db);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/settings', (_req, res) => {
  const db = loadDb();
  res.json(db.settings);
});

app.put('/api/settings', (req, res) => {
  const db = loadDb();
  if (req.body.lastActiveDocId !== undefined) {
    db.settings.lastActiveDocId = req.body.lastActiveDocId;
  }
  if (Array.isArray(req.body.customHighlighters)) {
    db.settings.customHighlighters = req.body.customHighlighters;
  }
  saveDb(db);
  res.json(db.settings);
});

app.get('/api/documents', (_req, res) => {
  const db = loadDb();
  const docsWithMeta = db.documents.map((doc) => {
    const anns = db.annotations[doc.id] || [];
    return {
      ...doc,
      annotationCount: anns.length,
    };
  });
  res.json(docsWithMeta);
});

app.get('/api/documents/:id', (req, res) => {
  const db = loadDb();
  const doc = db.documents.find((d) => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }
  db.settings.lastActiveDocId = doc.id;
  saveDb(db);

  const annotations = db.annotations[doc.id] || [];
  res.json({ ...doc, annotations });
});

app.get('/api/documents/:id/file', (req, res) => {
  const db = loadDb();
  const doc = db.documents.find((d) => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }
  const filePath = path.join(UPLOADS_DIR, doc.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo PDF não encontrado' });
  }
  res.sendFile(filePath);
});

app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const db = loadDb();
    let finalFilename = req.file.filename;
    let finalPath = req.file.path;
    let pageCount = 1;

    const ext = path.extname(req.file.originalname).toLowerCase();
    const rawTitle =
      req.body.title ||
      path.basename(req.file.originalname, path.extname(req.file.originalname));

    if (ext === '.txt' || ext === '.md') {
      const rawContent = fs.readFileSync(finalPath, 'utf-8');
      const pdfFilename = `${finalFilename}.pdf`;
      const pdfPath = path.join(UPLOADS_DIR, pdfFilename);
      pageCount = await generatePdfFromTextFile(rawTitle, rawContent, pdfPath);
      fs.unlinkSync(finalPath);
      finalFilename = pdfFilename;
      finalPath = pdfPath;
    } else {
      try {
        const pdfBytes = fs.readFileSync(finalPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } catch (e) {
        console.warn('Aviso ao ler pageCount:', e.message);
      }
    }

    const now = new Date().toISOString();
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: rawTitle,
      filename: finalFilename,
      pageCount,
      currentPage: 1,
      zoom: 1.15,
      createdAt: now,
      updatedAt: now,
    };

    db.documents.unshift(newDoc);
    db.annotations[newDoc.id] = [];
    db.settings.lastActiveDocId = newDoc.id;
    saveDb(db);

    res.status(201).json({
      ...newDoc,
      annotationCount: 0,
      annotations: [],
    });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ error: 'Falha ao processar o arquivo enviado' });
  }
});

app.patch('/api/documents/:id', (req, res) => {
  const db = loadDb();
  const idx = db.documents.findIndex((d) => d.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }

  const allowedFields = ['title', 'currentPage', 'zoom', 'pageCount'];
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      db.documents[idx][key] = req.body[key];
    }
  }
  db.documents[idx].updatedAt = new Date().toISOString();
  saveDb(db);
  res.json(db.documents[idx]);
});

// Delete ANY document (including the last one or sample files)
app.delete('/api/documents/:id', (req, res) => {
  const db = loadDb();
  const idx = db.documents.findIndex((d) => d.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }
  const [removed] = db.documents.splice(idx, 1);
  delete db.annotations[removed.id];

  if (db.settings.lastActiveDocId === removed.id) {
    db.settings.lastActiveDocId = db.documents[0]?.id || null;
  }
  db.seeded = true;
  saveDb(db);

  const filePath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_e) {
      // ignore
    }
  }

  res.json({
    success: true,
    nextDocId: db.settings.lastActiveDocId,
  });
});

app.get('/api/documents/:id/annotations', (req, res) => {
  const db = loadDb();
  res.json(db.annotations[req.params.id] || []);
});

app.post('/api/documents/:id/annotations', (req, res) => {
  const db = loadDb();
  const docId = req.params.id;
  if (!db.annotations[docId]) {
    db.annotations[docId] = [];
  }

  const newAnnotation = {
    ...req.body,
    id: req.body.id || `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.annotations[docId].push(newAnnotation);
  saveDb(db);
  res.status(201).json(newAnnotation);
});

app.put('/api/documents/:id/annotations/:annId', (req, res) => {
  const db = loadDb();
  const docId = req.params.id;
  const annId = req.params.annId;
  const list = db.annotations[docId] || [];
  const idx = list.findIndex((a) => a.id === annId);

  if (idx === -1) {
    const created = {
      ...req.body,
      id: annId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.push(created);
    db.annotations[docId] = list;
    saveDb(db);
    return res.json(created);
  }

  list[idx] = {
    ...list[idx],
    ...req.body,
    id: annId,
    updatedAt: new Date().toISOString(),
  };

  saveDb(db);
  res.json(list[idx]);
});

app.put('/api/documents/:id/annotations', (req, res) => {
  const db = loadDb();
  const docId = req.params.id;
  if (!Array.isArray(req.body.annotations)) {
    return res.status(400).json({ error: 'Formato inválido' });
  }
  db.annotations[docId] = req.body.annotations;
  saveDb(db);
  res.json(db.annotations[docId]);
});

app.delete('/api/documents/:id/annotations/:annId', (req, res) => {
  const db = loadDb();
  const docId = req.params.id;
  const annId = req.params.annId;
  const list = db.annotations[docId] || [];
  db.annotations[docId] = list.filter((a) => a.id !== annId);
  saveDb(db);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;

seedInitialData().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
});
