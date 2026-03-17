const galleryEl = document.getElementById('gallery');
const toastEl = document.getElementById('toast');
const promptCountEl = document.getElementById('promptCount');
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

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`تم نسخ البرومبت${label ? `: ${label}` : ''}`);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast(`تم نسخ البرومبت${label ? `: ${label}` : ''}`);
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function renderGallery() {
  promptCountEl.textContent = PROMPT_LIBRARY.length;

  galleryEl.innerHTML = PROMPT_LIBRARY.map(card => `
    <article class="card">
      <figure>
        <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title || 'نموذج بطاقة')}" loading="lazy" title="${escapeHtml(card.title || '')}" />
      </figure>
      <div class="card-actions">
        <button class="copy-btn" data-id="${escapeHtml(card.id)}" aria-label="نسخ برومبت ${escapeHtml(card.title || '')}">نسخ البرومبت</button>
      </div>
    </article>
  `).join('');

  galleryEl.querySelectorAll('.copy-btn').forEach(button => {
    button.addEventListener('click', () => {
      const card = PROMPT_LIBRARY.find(item => item.id === button.dataset.id);
      if (!card) return;
      copyText(buildPrompt(card), card.title || '');
    });
  });
}

renderGallery();
