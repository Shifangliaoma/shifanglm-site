/**
 * server.js
 * Express 服务，新增：
 *  - POST /api/upload-image (multipart) -> 上传图片到 public/uploads，返回 url
 *  - POST /api/import (json: { posts, images }) -> 批量导入（图片以 base64 提交），保存图片并创建帖子
 *
 * 仍保留 /api/posts CRUD。
 *
 * 使用：
 *  npm install
 *  npm start
 *
 * 注意：导入接口接收较大 payload，express.json 的 limit 已调大。
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const DB_PATH = path.join(__dirname, 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
// 增大 body limit 以便接收 base64 图片导入包（按需调整）
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));

// 静态托管 public/（含 uploads）
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
app.use('/uploads', express.static(UPLOAD_DIR));

// 简单文件 db.json 读写
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const sample = { posts: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(sample, null, 2), 'utf8');
      return sample;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error('读取 db.json 错误', err);
    return { posts: [] };
  }
}
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('写入 db.json 错误', err);
    return false;
  }
}
function genId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

/**
 * GET /api/posts
 */
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const posts = (db.posts || []).slice().sort((a,b)=>b.createdAt - a.createdAt);
  res.json({ ok: true, posts });
});

/**
 * POST /api/posts
 */
app.post('/api/posts', (req, res) => {
  const { title, content, tags, images } = req.body || {};
  if (!title || !content) return res.status(400).json({ ok:false, error: '缺少 title 或 content' });
  const db = readDB();
  const post = {
    id: genId(),
    title: String(title).slice(0,200),
    content: String(content),
    tags: Array.isArray(tags) ? tags.slice(0,10) : [],
    images: Array.isArray(images) ? images : [],
    createdAt: Date.now()
  };
  db.posts = db.posts || [];
  db.posts.push(post);
  if (!writeDB(db)) return res.status(500).json({ ok:false, error:'保存失败' });
  res.json({ ok:true, post });
});

/**
 * PUT /api/posts/:id
 */
app.put('/api/posts/:id', (req,res) => {
  const id = req.params.id;
  const { title, content, tags, images } = req.body || {};
  const db = readDB();
  db.posts = db.posts || [];
  const idx = db.posts.findIndex(p=>p.id===id);
  if (idx === -1) return res.status(404).json({ ok:false, error:'未找到帖子' });
  if (title !== undefined) db.posts[idx].title = String(title).slice(0,200);
  if (content !== undefined) db.posts[idx].content = String(content);
  if (tags !== undefined) db.posts[idx].tags = Array.isArray(tags) ? tags.slice(0,10) : db.posts[idx].tags;
  if (images !== undefined) db.posts[idx].images = Array.isArray(images) ? images : db.posts[idx].images;
  if (!writeDB(db)) return res.status(500).json({ ok:false, error:'保存失败' });
  res.json({ ok:true, post: db.posts[idx] });
});

/**
 * DELETE /api/posts/:id
 */
app.delete('/api/posts/:id', (req,res) => {
  const id = req.params.id;
  const db = readDB();
  const len = db.posts.length;
  db.posts = db.posts.filter(p=>p.id!==id);
  if (db.posts.length === len) return res.status(404).json({ ok:false, error:'未找到帖子' });
  if (!writeDB(db)) return res.status(500).json({ ok:false, error:'保存失败' });
  res.json({ ok:true });
});

/**
 * 图片上传：POST /api/upload-image
 * 字段: image (file)
 * 返回: { ok:true, url: '/uploads/xxxx.ext' }
 */
const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, UPLOAD_DIR),
  filename: (req,file,cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });
app.post('/api/upload-image', upload.single('image'), (req,res) => {
  if (!req.file) return res.status(400).json({ ok:false, error:'未提供图片' });
  const url = '/uploads/' + req.file.filename;
  res.json({ ok:true, url });
});

/**
 * 批量导入：POST /api/import
 * body: { posts: [ { title, content, tags, images: [filenameRef] } ], images: [ { name, data } ] }
 *  - images[].data: base64 字符串（无 data: 前缀）
 *  - posts 中 images 字段引用 images[].name（导出时保存的原文件名或键）
 *
 * 服务端会把 images 保存到 uploads，并替换 posts 中的引用为新的 URL，然后写入 db.json。
 */
app.post('/api/import', async (req,res) => {
  try {
    const payload = req.body || {};
    const { posts: incomingPosts = [], images: incomingImages = [] } = payload;
    const savedMap = {}; // name -> url

    // 保存图片
    for (const img of incomingImages) {
      if (!img.name || !img.data) continue;
      // 解析 base64
      const buffer = Buffer.from(img.data, 'base64');
      // 尝试保留扩展名，如果 name 包含扩展，则使用，否则推断为 .png
      const ext = path.extname(img.name) || '.png';
      const fname = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8) + ext;
      const dest = path.join(UPLOAD_DIR, fname);
      fs.writeFileSync(dest, buffer);
      savedMap[img.name] = '/uploads/' + fname;
    }

    // 处理帖子：将 images 引用替换为已保存 URL（若找不到对应图片则删除引用）
    const db = readDB();
    db.posts = db.posts || [];
    for (const p of incomingPosts) {
      const post = {
        id: genId(),
        title: String(p.title || '').slice(0,200),
        content: String(p.content || ''),
        tags: Array.isArray(p.tags) ? p.tags.slice(0,10) : [],
        images: Array.isArray(p.images) ? p.images.map(n => savedMap[n]).filter(Boolean) : [],
        createdAt: p.createdAt || Date.now()
      };
      db.posts.push(post);
    }

    if (!writeDB(db)) return res.status(500).json({ ok:false, error:'写入 db 失败' });
    res.json({ ok:true, added: incomingPosts.length });
  } catch (err) {
    console.error('导入失败', err);
    res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * SPA fallback (如果 public 存在)
 */
if (fs.existsSync(publicDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
  console.log('API: GET  /api/posts');
  console.log('API: POST /api/posts');
  console.log('API: POST /api/upload-image');
  console.log('API: POST /api/import');
});
