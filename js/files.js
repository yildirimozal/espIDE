import { t } from './i18n.js';
// files.js — Cihaz dosya agaci + yerel klasor senkronu (File System Access API).

const ICON = { dir: '📁', file: '📄', py: '🐍', boot: '⚙️', main: '▶️' };
function iconFor(name, type) {
  if (type === 'dir') return ICON.dir;
  if (name === 'boot.py') return ICON.boot;
  if (name === 'main.py') return ICON.main;
  if (name.endsWith('.py')) return ICON.py;
  return ICON.file;
}
function join(base, name) { return (base === '/' ? '' : base) + '/' + name; }
function fmtSize(n) { return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB'; }

export class DeviceFiles {
  constructor(container, repl, callbacks = {}) {
    this.el = container;
    this.repl = repl;
    this.cb = callbacks;       // { openFile(path), status(msg) }
    this.selected = null;
    this.selectedType = null;
  }

  async refresh() {
    this.el.innerHTML = '<div class="muted small">' + t('fs_loading') + '</div>';
    try {
      const root = document.createElement('ul');
      root.className = 'tree';
      await this._renderInto(root, '/');
      this.el.innerHTML = '';
      this.el.appendChild(root);
    } catch (e) {
      this.el.innerHTML = '<div class="err small">' + t('fs_list_err', { e: e.message }) + '</div>';
    }
  }

  async _renderInto(ul, path) {
    const items = await this.repl.fsList(path);
    items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    for (const it of items) {
      const full = join(path, it.name);
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'node';
      row.dataset.path = full;
      row.dataset.type = it.type;
      row.innerHTML = `<span class="ic">${iconFor(it.name, it.type)}</span>
        <span class="nm">${it.name}</span>
        <span class="sz">${it.type === 'file' ? fmtSize(it.size) : ''}</span>`;
      li.appendChild(row);

      row.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._select(row, full, it.type);
        if (it.type === 'dir') {
          if (li.classList.toggle('open')) {
            const sub = document.createElement('ul');
            sub.className = 'tree';
            li.appendChild(sub);
            try { await this._renderInto(sub, full); } catch (_) {}
          } else {
            const sub = li.querySelector('ul'); if (sub) sub.remove();
          }
        } else if (this.cb.openFile) {
          this.cb.openFile(full);
        }
      });
      ul.appendChild(li);
    }
  }

  _select(row, path, type) {
    this.el.querySelectorAll('.node.sel').forEach((n) => n.classList.remove('sel'));
    row.classList.add('sel');
    this.selected = path;
    this.selectedType = type;
  }
}

// --- Cihazi ozyinelemeli gez (tum dosya yollari) ---
export async function walkDevice(repl, path = '/', acc = []) {
  const items = await repl.fsList(path);
  for (const it of items) {
    const full = join(path, it.name);
    if (it.type === 'dir') await walkDevice(repl, full, acc);
    else acc.push(full);
  }
  return acc;
}

// --- Yerel klasor senkronu (File System Access API, Chrome/Edge) ---
export async function pickLocalFolder() {
  if (!window.showDirectoryPicker) throw new Error(t('fs_no_fsa'));
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

// Yereldeki tum dosyalari topla (alt klasorler dahil) -> [{path, handle}]
async function walkLocal(dirHandle, prefix = '', acc = []) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    const rel = prefix + '/' + name;
    if (handle.kind === 'file') acc.push({ path: rel, handle });
    else if (handle.kind === 'directory') await walkLocal(handle, rel, acc);
  }
  return acc;
}

async function ensureDeviceDirs(repl, filePath) {
  const parts = filePath.split('/').filter(Boolean);
  parts.pop(); // dosya adini cikar
  let cur = '';
  for (const p of parts) {
    cur += '/' + p;
    try { await repl.fsMkdir(cur); } catch (e) { /* zaten var */ }
  }
}

// Yerel -> Cihaz
export async function pushToDevice(repl, dirHandle, onLog = () => {}) {
  const files = await walkLocal(dirHandle);
  onLog(t('fs_count_push', { n: files.length }));
  for (const f of files) {
    const file = await f.handle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    await ensureDeviceDirs(repl, f.path);
    await repl.fsWrite(f.path, bytes);
    onLog(`→ ${f.path} (${bytes.length} B)\n`);
  }
  onLog(t('fs_push_done'));
}

// Cihaz -> Yerel
export async function pullFromDevice(repl, dirHandle, onLog = () => {}) {
  const paths = await walkDevice(repl, '/');
  onLog(t('fs_count_pull', { n: paths.length }));
  for (const p of paths) {
    const bytes = await repl.fsRead(p);
    // yerel klasor yapisini olustur
    const parts = p.split('/').filter(Boolean);
    const fname = parts.pop();
    let dir = dirHandle;
    for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: true });
    const fh = await dir.getFileHandle(fname, { create: true });
    const w = await fh.createWritable();
    await w.write(bytes); await w.close();
    onLog(`← ${p} (${bytes.length} B)\n`);
  }
  onLog(t('fs_pull_done'));
}
