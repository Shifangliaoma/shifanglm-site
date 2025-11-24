// app.js（Server-enabled + 图片上传 + 导出/导入 + 背景音乐控制）
// 说明：API_BASE 默认为 '/api'（与 server.js 同源）
// 导出会把帖子与图片打包为一个 JSON，导入会把该 JSON 上传到 /api/import（服务器会保存图片并写入 db）

const API_BASE = (window.API_BASE || '/api').replace(/\/$/, '');

// ---------------- Matrix Rain ---------------
(function matrixRain(){
  const canvas = document.getElementById('matrix');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let w,h;
  const resize = ()=>{ w = canvas.width = innerWidth; h = canvas.height = innerHeight; };
  addEventListener('resize', resize); resize();

  const chars = '01零一二三四五六七八九十走势冷热和值跨度尾数'.split('');
  const fontSize = Math.max(12, Math.floor(window.innerWidth/40));
  const columns = Math.floor(w/fontSize);
  const drops = Array.from({length:columns}).map(()=>Math.random()*h);

  function draw(){
    ctx.fillStyle = 'rgba(2,3,8,0.18)';
    ctx.fillRect(0,0,w,h);
    ctx.font = `${fontSize}px monospace`;
    for(let i=0;i<columns;i++){
      const text = chars[Math.floor(Math.random()*chars.length)];
      const x = i*fontSize;
      const y = (drops[i] * fontSize) % h;
      const g = ctx.createLinearGradient(x,y-fontSize,x,y);
      g.addColorStop(0, 'rgba(0,249,255,0.05)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,45,149,0.08)');
      ctx.fillStyle = g;
      ctx.fillText(text, x, y);
      if(drops[i]*fontSize > h && Math.random() > 0.975) drops[i]=0;
      drops[i] += 0.8 + Math.random()*0.6;
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ---------------- Helpers ----------------
function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"'`]/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m]));
}
function downloadFile(filename, content){
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 5000);
}

// ---------------- Storage ----------------
const STORAGE_KEY = 'cyber_posts_v1';
function loadPostsLocal(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(!raw) return null; return JSON.parse(raw); }catch(e){ return null; } }
function savePostsLocal(posts){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }catch(e){} }

// ---------------- Server interactions ----------------
async function fetchPostsFromServer(){
  const res = await fetch(API_BASE + '/posts');
  if(!res.ok) throw new Error('网络错误: ' + res.status);
  const json = await res.json();
  if(json && json.ok && Array.isArray(json.posts)) return json.posts;
  if(Array.isArray(json)) return json;
  return [];
}
async function createPostToServer(post){
  const res = await fetch(API_BASE + '/posts', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(post) });
  if(!res.ok) throw new Error('网络错误: ' + res.status);
  const json = await res.json();
  if(json && json.ok && json.post) return json.post;
  throw new Error('服务器返回格式异常');
}
async function uploadImageFile(file){
  const fd = new FormData(); fd.append('image', file);
  const res = await fetch(API_BASE + '/upload-image', { method: 'POST', body: fd });
  if(!res.ok) throw new Error('上传失败: ' + res.status);
  const json = await res.json();
  if(json && json.ok && json.url) return json.url;
  throw new Error('上传返回异常');
}
async function postImportPackage(pkg){
  const res = await fetch(API_BASE + '/import', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(pkg) });
  if(!res.ok) throw new Error('导入失败: ' + res.status);
  const json = await res.json();
  return json;
}

// ---------------- Render posts ----------------
const postsEl = document.getElementById('posts');
let posts = [];

function renderPosts(filter=''){
  if(!postsEl) return;
  const q = (filter || '').trim().toLowerCase();
  const list = (posts||[]).slice().sort((a,b)=>b.createdAt - a.createdAt).filter(p=>{
    if(!q) return true;
    return (p.title + ' ' + p.content + ' ' + (p.tags||[]).join(' ')).toLowerCase().includes(q);
  });

  postsEl.innerHTML = list.map(p=>{
    const time = new Date(p.createdAt).toLocaleString();
    const title = escapeHtml(p.title);
    const content = escapeHtml(p.content).replace(/\n/g,'<br>');
    const tagsHtml = (p.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('');
    const imgs = (p.images||[]).map(u => `<img src="${escapeHtml(u)}" alt="img" />`).join('');
    const imagesHtml = imgs ? `<div class="images">${imgs}</div>` : '';
    return `
      <article class="post" data-id="${p.id}">
        <div class="meta">
          <div class="title">${title}</div>
          <div class="time">${time}</div>
        </div>
        <div class="body">${content}</div>
        ${imagesHtml}
        <div class="tags">${tagsHtml}</div>
      </article>
    `;
  }).join('');
}

// ---------------- Init: load posts (prefer server) ----------------
async function initPosts(){
  const local = loadPostsLocal();
  if(local && Array.isArray(local) && local.length){
    posts = local;
    renderPosts();
  }
  try {
    const serverPosts = await fetchPostsFromServer();
    if(Array.isArray(serverPosts)){
      posts = serverPosts;
      savePostsLocal(posts);
      renderPosts();
    }
  } catch(err){
    if(!local || (Array.isArray(local) && !local.length)){
      posts = [{
        id: 'p_local_1', title: '【示例】离线模式', content:'当前无法连接服务器，数据将保存在本地。', tags:['本地'], images:[]
      }];
      savePostsLocal(posts);
      renderPosts();
    }
    console.warn('使用本地缓存/离线模式', err);
  }
}
initPosts();

const searchInput = document.getElementById('searchInput');
if(searchInput) searchInput.addEventListener('input', e => renderPosts(e.target.value));

// ---------------- Post modal & image upload during post ----------------
const postModal = document.getElementById('postModal');
const addPostBtn = document.getElementById('addPostBtn');
const fabAdd = document.getElementById('fabAdd');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const postForm = document.getElementById('postForm');
const postTitle = document.getElementById('postTitle');
const postContent = document.getElementById('postContent');
const postTags = document.getElementById('postTags');
const postImages = document.getElementById('postImages');
const imagePreviews = document.getElementById('imagePreviews');

function openModal(){ if(postModal) postModal.setAttribute('aria-hidden','false'); if(postTitle) postTitle.focus(); }
function closeModalFn(){ if(postModal) postModal.setAttribute('aria-hidden','true'); if(postForm) postForm.reset(); imagePreviews.innerHTML=''; }

if(addPostBtn) addPostBtn.addEventListener('click', openModal);
if(fabAdd) fabAdd.addEventListener('click', openModal);
if(closeModal) closeModal.addEventListener('click', closeModalFn);
if(cancelBtn) cancelBtn.addEventListener('click', closeModalFn);

// 预览选中的图片
postImages && postImages.addEventListener('change', (e)=>{
  imagePreviews.innerHTML = '';
  const files = Array.from(e.target.files || []);
  files.forEach(file=>{
    const url = URL.createObjectURL(file);
    const d = document.createElement('div'); d.className='preview';
    const img = document.createElement('img'); img.src = url;
    d.appendChild(img); imagePreviews.appendChild(d);
    // 释放 objectURL 在图片加载后
    img.onload = ()=>{ URL.revokeObjectURL(url) };
  });
});

// 提交表单：上传图片 -> 发布帖子
postForm && postForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const title = (postTitle.value || '').trim();
  const content = (postContent.value || '').trim();
  const tags = (postTags.value || '').split(',').map(t=>t.trim()).filter(Boolean);
  if(!title || !content) return alert('请填写标题与内容');

  const files = Array.from(postImages.files || []);
  // 创建临时客户端帖子（乐观）
  const tmpId = 'tmp_' + Date.now();
  const tmpPost = { id: tmpId, title, content, tags, images: [], createdAt: Date.now() };
  posts.unshift(tmpPost); savePostsLocal(posts); renderPosts();
  closeModalFn();

  // 上传图片（如果有且服务器可用）
  const uploadedUrls = [];
  if(files.length){
    for(const file of files){
      try {
        const url = await uploadImageFile(file);
        uploadedUrls.push(url);
      } catch(err){
        console.warn('图片上传失败，跳过该图', err);
      }
    }
  }

  // 构造要创建的帖子
  const postToCreate = { title, content, tags, images: uploadedUrls };
  try {
    const serverPost = await createPostToServer(postToCreate);
    // 替换 tmp
    posts = posts.map(p => p.id === tmpId ? serverPost : p);
    // 确保服务器帖子存在于头部
    if(!posts.find(p=>p.id===serverPost.id)) posts.unshift(serverPost);
    savePostsLocal(posts);
    renderPosts();
  } catch(err){
    // 失败则保留本地数据（包括临时图片链接为空）
    alert('发布到服务器失败，帖子已保存在本地。网络恢复后请刷新页面以尝试同步。');
    console.warn('发布失败，保留本地', err);
  }
});

// ---------------- Export posts (含图片 base64) ----------------
const exportBtn = document.getElementById('exportBtn');
exportBtn && exportBtn.addEventListener('click', async ()=>{
  try {
    // 优先使用当前 posts 列表（已包含 images 字段）
    const list = posts.slice();
    // 收集所有图片 URL
    const imgUrls = new Map(); // url -> filenameKey
    list.forEach((p, idx) => {
      (p.images||[]).forEach((u, i)=>{
        if(u && !imgUrls.has(u)) imgUrls.set(u, `img_${imgUrls.size}_${Date.now()}`);
      });
    });

    const images = [];
    for(const [url, key] of imgUrls.entries()){
      try {
        // fetch binary
        const abs = url.startsWith('http') ? url : (location.origin + (url.startsWith('/')?url:`/${url}`));
        const res = await fetch(abs);
        if(!res.ok) throw new Error('fetch image failed');
        const blob = await res.blob();
        // convert to base64
        const b64 = await blobToBase64(blob);
        // strip data:...;base64, prefix
        const idxComma = b64.indexOf(',');
        const pure = idxComma >= 0 ? b64.slice(idxComma+1) : b64;
        images.push({ name: key, data: pure, mime: blob.type });
      } catch(err){
        console.warn('导出图片失败', url, err);
      }
    }

    // 在 posts 中把图片 url 替换为其 key（导入时使用）
    const exportedPosts = list.map(p=>{
      const pcopy = Object.assign({}, p);
      pcopy.images = (p.images||[]).map(u => imgUrls.get(u)).filter(Boolean);
      return pcopy;
    });

    const pkg = { exportedAt: Date.now(), posts: exportedPosts, images };
    downloadFile(`cyber_posts_export_${Date.now()}.json`, JSON.stringify(pkg, null, 2));
  } catch(err){
    alert('导出失败：' + err.message);
    console.error(err);
  }
});

function blobToBase64(blob){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------------- Import posts（包含 base64 图片） ----------------
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
importBtn && importBtn.addEventListener('click', ()=> importFile.click());

importFile && importFile.addEventListener('change', async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try {
    const text = await file.text();
    const pkg = JSON.parse(text);
    if(!pkg || !Array.isArray(pkg.posts)) throw new Error('文件格式不正确');
    // 如果服务器支持 /api/import，优先 POST 整个包到服务器由服务器处理图片与帖子保存
    try {
      const res = await postImportPackage(pkg);
      if(res && res.ok) {
        alert('导入成功！将尝试从服务器拉取最新帖子。');
        // 刷新列表
        const serverPosts = await fetchPostsFromServer();
        posts = serverPosts;
        savePostsLocal(posts);
        renderPosts();
        return;
      } else {
        throw new Error('服务器返回错误');
      }
    } catch(err){
      console.warn('服务器导入失败，尝试本地导入', err);
      // 回退：将 images base64 解码为 objectURLs 并保存为 local posts (不会上传图片到服务器)
      const imgsMap = {};
      if(Array.isArray(pkg.images)){
        for(const img of pkg.images){
          try{
            const dataUrl = `data:${img.mime || 'image/png'};base64,${img.data}`;
            imgsMap[img.name] = dataUrl;
          }catch(e){}
        }
      }
      const imported = (pkg.posts||[]).map(p=>{
        const pcopy = Object.assign({}, p);
        pcopy.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        pcopy.images = (p.images||[]).map(k => imgsMap[k]).filter(Boolean);
        return pcopy;
      });
      // 合并到本地 posts 并保存
      posts = imported.concat(posts || []);
      savePostsLocal(posts);
      renderPosts();
      alert('导入到本地完成（服务器不可用时）。若要上传到服务器，请确保网络可用并使用「发布」功能重新上传图片。');
    }
  } catch(err){
    alert('导入失败: ' + err.message);
    console.error(err);
  } finally {
    importFile.value = '';
  }
});

// ---------------- Hacker UI ----------------
const hacker = document.getElementById('hacker');
const toggleHacker = document.getElementById('toggleHacker');
function createHackerContent(){ if(!hacker) return; hacker.innerHTML = '<div class="glitch" aria-hidden="true"></div>'; hacker.addEventListener('click', ()=> alert('联系 QQ: 921913231\\n网站：十方料码，伪序专业趋势数据\\n每日更新心得技巧（仅供参考）')); }
createHackerContent();
if(toggleHacker){
  toggleHacker.addEventListener('click', ()=>{
    if(!hacker) return;
    const hidden = hacker.getAttribute('aria-hidden') === 'true';
    hacker.setAttribute('aria-hidden', hidden ? 'false' : 'true');
    hacker.style.display = hidden ? 'flex' : 'none';
    toggleHacker.textContent = hidden ? '隐藏黑客' : '显示黑客';
  });
}

// ---------------- 背景音乐控制（移动端尝试在首次交互后播放） ----------------
const bgMusic = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
let musicPlaying = false;

async function tryPlayMusic(){
  if(!bgMusic) return;
  try {
    await bgMusic.play();
    musicPlaying = true;
    musicToggle && (musicToggle.textContent = '⏸');
  } catch(err){
    // autoplay 被阻止，等待用户交互
    musicPlaying = false;
    musicToggle && (musicToggle.textContent = '▶');
  }
}
// 在用户首次交互时尝试播放
const userGestureListener = () => { tryPlayMusic(); window.removeEventListener('touchstart', userGestureListener); window.removeEventListener('click', userGestureListener); };
window.addEventListener('touchstart', userGestureListener, { passive:true });
window.addEventListener('click', userGestureListener, { once:true });

// 手动切换
if(musicToggle){
  musicToggle.addEventListener('click', ()=>{
    if(!bgMusic) return;
    if(musicPlaying){ bgMusic.pause(); musicPlaying=false; musicToggle.textContent='▶'; }
    else { bgMusic.play().then(()=>{ musicPlaying=true; musicToggle.textContent='⏸'; }).catch(()=>{ musicPlaying=false; alert('浏览器阻止自动播放，请在手机上点击播放'); }); }
  });
}

// 小提示：在首次访问显示引导（保留）
(function welcomeTip(){
  const key = 'cyber_welcome_shown_v2';
  if(localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  setTimeout(()=> {
    if(confirm('欢迎使用“十方料码”演示页面。是否查看快速使用说明？')) {
      alert('说明：顶部「导 出」可导出帖子及图片为 JSON；「导 入」可导入该 JSON（服务器支持情况下上传图片到服务器并写库）。右下 + 或顶部「发 帖」可发布帖子；图片会上传到服务器并保存到 /uploads。背景音乐会在首次交互后尝试播放。祝记录顺利！');
    }
  }, 1000);
})();
