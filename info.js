const formEls = {
  id: document.getElementById('cardId'),
  title: document.getElementById('cardTitle'),
  image: document.getElementById('cardImage'),
  prompt: document.getElementById('cardPrompt')
};

const listEl = document.getElementById('cardList');
const cardCountEl = document.getElementById('cardCount');
const rawEditorEl = document.getElementById('rawEditor');
const fileInputEl = document.getElementById('fileInput');
const toastEl = document.getElementById('toast');
const addBtn = document.getElementById('addBtn');

let libraryState = [];
let editingId = null;
let toastTimer = null;

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPrompt(card) {
  if (card.prompt) return card.prompt;
  if (!card.template) return '';

  const defaults = Object.fromEntries((card.variables || []).map(item => [item.key, item.default || '']));
  return card.template.replace(/\{\{(.*?)\}\}/g, (_, key) => defaults[key.trim()] ?? '');
}

function normalizeCard(card) {
  return {
    id: String(card.id || '').trim(),
    title: String(card.title || '').trim(),
    image: String(card.image || '').trim(),
    prompt: String(buildPrompt(card) || '').trim()
  };
}

function slugifyArabicTitle(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '_')
    .replace(/[^\u0621-\u064A0-9a-zA-Z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function jsString(str) {
  return JSON.stringify(String(str));
}

function templateString(str) {
  return '`' + String(str)
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${') + '`';
}

function cardsToJs(cards) {
  const body = cards.map(card => {
    return `  {\n    id: ${jsString(card.id)},\n    title: ${jsString(card.title)},\n    image: ${jsString(card.image)},\n    prompt: ${templateString(card.prompt)}\n  }`;
  }).join(',\n\n');

  return `const PROMPT_LIBRARY = [\n${body}\n];\n`;
}

function parsePromptsSource(source) {
  const loaded = new Function(`${source}\n; return typeof PROMPT_LIBRARY !== 'undefined' ? PROMPT_LIBRARY : [];`)();
  if (!Array.isArray(loaded)) throw new Error('لم يتم العثور على PROMPT_LIBRARY.');
  return loaded.map(normalizeCard).filter(card => card.id && card.image && card.prompt);
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  showToast(successMessage);
}

function resetForm() {
  formEls.id.value = '';
  formEls.title.value = '';
  formEls.image.value = '';
  formEls.prompt.value = '';
  editingId = null;
  addBtn.textContent = 'إضافة البطاقة';
}

function fillForm(card) {
  formEls.id.value = card.id;
  formEls.title.value = card.title;
  formEls.image.value = card.image;
  formEls.prompt.value = card.prompt;
  editingId = card.id;
  addBtn.textContent = 'تحديث البطاقة';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncRawEditor() {
  rawEditorEl.value = cardsToJs(libraryState);
}

function renderList() {
  cardCountEl.textContent = libraryState.length;
  listEl.innerHTML = libraryState.map((card, index) => `
    <article class="list-item">
      <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title || card.id)}" loading="lazy">
      <div class="list-meta">
        <h3>${index + 1}. ${escapeHtml(card.title || card.id)}</h3>
        <p><strong>id:</strong> ${escapeHtml(card.id)}</p>
        <p><strong>image:</strong> ${escapeHtml(card.image)}</p>
      </div>
      <div class="list-actions">
        <button class="small-btn" data-action="edit" data-id="${escapeHtml(card.id)}">تحميل للتعديل</button>
        <button class="small-btn" data-action="copy" data-id="${escapeHtml(card.id)}">نسخ البرومبت</button>
        <button class="small-btn danger" data-action="delete" data-id="${escapeHtml(card.id)}">حذف</button>
      </div>
    </article>
  `).join('');

  listEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = libraryState.find(item => item.id === btn.dataset.id);
      if (!card) return;

      if (btn.dataset.action === 'edit') {
        fillForm(card);
        return;
      }

      if (btn.dataset.action === 'copy') {
        await copyText(card.prompt, 'تم نسخ البرومبت');
        return;
      }

      if (btn.dataset.action === 'delete') {
        libraryState = libraryState.filter(item => item.id !== card.id);
        if (editingId === card.id) resetForm();
        syncRawEditor();
        renderList();
        showToast('تم حذف البطاقة');
      }
    });
  });
}

function loadState(cards) {
  libraryState = cards.map(normalizeCard).filter(card => card.id && card.image && card.prompt);
  syncRawEditor();
  renderList();
}

function collectFormCard() {
  const card = {
    id: formEls.id.value.trim(),
    title: formEls.title.value.trim(),
    image: formEls.image.value.trim(),
    prompt: formEls.prompt.value.trim()
  };

  if (!card.id || !card.image || !card.prompt) {
    throw new Error('الحقول المطلوبة هي: id، ومسار الصورة، والبرومبت الكامل.');
  }

  return card;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initializeFromCurrentLibrary() {
  if (typeof PROMPT_LIBRARY === 'undefined' || !Array.isArray(PROMPT_LIBRARY)) {
    loadState([]);
    return;
  }
  loadState(PROMPT_LIBRARY);
}

document.getElementById('slugBtn').addEventListener('click', () => {
  const source = formEls.title.value || formEls.id.value;
  formEls.id.value = slugifyArabicTitle(source || 'new_card_id');
});

document.getElementById('clearBtn').addEventListener('click', resetForm);

document.getElementById('addBtn').addEventListener('click', () => {
  try {
    const card = collectFormCard();
    const existingIndex = libraryState.findIndex(item => item.id === (editingId || card.id));

    if (existingIndex >= 0) {
      libraryState[existingIndex] = card;
      showToast('تم تحديث البطاقة');
    } else {
      libraryState.push(card);
      showToast('تمت إضافة البطاقة');
    }

    editingId = null;
    addBtn.textContent = 'إضافة البطاقة';
    syncRawEditor();
    renderList();
    resetForm();
  } catch (error) {
    showToast(error.message || 'تعذر إضافة البطاقة');
  }
});

document.getElementById('loadCurrentBtn').addEventListener('click', () => {
  initializeFromCurrentLibrary();
  showToast('تم تحميل الملف الحالي من الموقع');
});

document.getElementById('importBtn').addEventListener('click', () => fileInputEl.click());

fileInputEl.addEventListener('change', async () => {
  const file = fileInputEl.files?.[0];
  if (!file) return;

  try {
    const source = await file.text();
    const cards = parsePromptsSource(source);
    loadState(cards);
    resetForm();
    showToast(`تم استيراد ${cards.length} بطاقة`);
  } catch (error) {
    showToast(error.message || 'تعذر استيراد الملف');
  }

  fileInputEl.value = '';
});

document.getElementById('applyRawBtn').addEventListener('click', () => {
  try {
    const cards = parsePromptsSource(rawEditorEl.value);
    loadState(cards);
    resetForm();
    showToast('تم تطبيق النص من المحرر');
  } catch (error) {
    showToast(error.message || 'تعذر تطبيق النص من المحرر');
  }
});

document.getElementById('copyFileBtn').addEventListener('click', () => {
  copyText(rawEditorEl.value, 'تم نسخ ملف prompts.js');
});

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadTextFile('prompts.js', rawEditorEl.value);
  showToast('تم تصدير prompts.js');
});

initializeFromCurrentLibrary();
