/**
 * DevFiller — content.js
 * Injecté dans toutes les pages. Analyse le DOM pour trouver les champs
 * de formulaire et communique avec background.js pour le remplissage IA.
 */

// Guard : empêche la double exécution si injecté à la fois par le manifest et manuellement
if (window.__DEVFILLER_LOADED__) {
  // Déjà chargé — on ignore silencieusement
} else {
window.__DEVFILLER_LOADED__ = true;

// ─── Constantes ────────────────────────────────────────────────────────────
const DEVFILLER_HIGHLIGHT_CLASS = 'devfiller-highlighted';
const DEVFILLER_FILLED_CLASS    = 'devfiller-filled';
const DEVFILLER_STYLE_ID        = 'devfiller-styles';

// ─── Injection des styles visuels ──────────────────────────────────────────
function injectStyles() {
  if (document.getElementById(DEVFILLER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DEVFILLER_STYLE_ID;
  style.textContent = `
    .${DEVFILLER_HIGHLIGHT_CLASS} {
      outline: 2px dashed rgba(255,255,255,0.25) !important;
      background: rgba(255,255,255,0.03) !important;
      transition: all 0.15s ease;
    }
    .${DEVFILLER_FILLED_CLASS} {
      outline: 2px solid #22c55e !important;
      background: rgba(34, 197, 94, 0.06) !important;
      transition: all 0.3s ease;
    }
    #devfiller-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background: #161616;
      color: #f0f0f0;
      padding: 10px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      border: 1px solid #2a2a2a;
      display: flex;
      align-items: center;
      gap: 9px;
      animation: devfiller-slide-in 0.2s ease;
      letter-spacing: -0.01em;
    }
    @keyframes devfiller-slide-in {
      from { transform: translateY(10px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    #devfiller-toast .devfiller-spinner {
      width: 14px; height: 14px;
      border: 1.5px solid #333;
      border-top-color: #888;
      border-radius: 50%;
      animation: devfiller-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes devfiller-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// ─── Toast notification ────────────────────────────────────────────────────
function showToast(message, type = 'loading') {
  let toast = document.getElementById('devfiller-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'devfiller-toast';
    document.body.appendChild(toast);
  }

  const icons = {
    loading: '<div class="devfiller-spinner"></div>',
    success: '✅',
    error:   '❌',
    info:    '💡',
  };

  toast.innerHTML = `${icons[type] || ''}  <span>${message}</span>`;
  toast.style.display = 'flex';

  if (type !== 'loading') {
    setTimeout(() => {
      if (toast) toast.style.display = 'none';
    }, 3000);
  }
}

function hideToast() {
  const toast = document.getElementById('devfiller-toast');
  if (toast) toast.style.display = 'none';
}

// ─── Extraction des champs de formulaire ───────────────────────────────────
function getFieldLabel(el) {
  // 1. <label for="...">
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  // 2. Parent label
  const parentLabel = el.closest('label');
  if (parentLabel) return parentLabel.innerText.replace(el.value, '').trim();

  // 3. aria-label
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');

  // 4. aria-labelledby
  const labelledById = el.getAttribute('aria-labelledby');
  if (labelledById) {
    const labelEl = document.getElementById(labelledById);
    if (labelEl) return labelEl.innerText.trim();
  }

  // 5. Texte du nœud précédent (heuristique)
  const prev = el.previousElementSibling;
  if (prev && ['LABEL', 'SPAN', 'P', 'DIV', 'LEGEND'].includes(prev.tagName)) {
    return prev.innerText.trim();
  }

  return '';
}

function extractFormFields() {
  const selectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), textarea, select';
  const elements = Array.from(document.querySelectorAll(selectors));

  const fields = [];
  elements.forEach((el, index) => {
    if (!el.offsetParent && el.type !== 'hidden') return; // skip invisible

    const label       = getFieldLabel(el);
    const placeholder = el.getAttribute('placeholder') || '';
    const name        = el.getAttribute('name') || '';
    const id          = el.getAttribute('id') || '';
    const type        = el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || 'text');
    const required    = el.required;

    let options = [];
    if (el.tagName === 'SELECT') {
      options = Array.from(el.options)
        .filter(o => o.value)
        .map(o => ({ value: o.value, text: o.text }));
    }

    el.dataset.devfillerId = `devfiller-${index}`;
    el.classList.add(DEVFILLER_HIGHLIGHT_CLASS);

    fields.push({
      devfillerId: `devfiller-${index}`,
      type,
      label:       label || placeholder || name || id || `Champ ${index + 1}`,
      placeholder,
      name,
      id,
      required,
      options,
    });
  });

  return fields;
}

// ─── Application des valeurs IA sur les champs ────────────────────────────
function applyValues(filledFields) {
  let count = 0;
  filledFields.forEach(({ devfillerId, value }) => {
    const el = document.querySelector(`[data-devfiller-id="${devfillerId}"]`);
    if (!el || !value) return;

    if (el.tagName === 'SELECT') {
      // Chercher la meilleure option
      const opts = Array.from(el.options);
      const match = opts.find(o =>
        o.value.toLowerCase() === String(value).toLowerCase() ||
        o.text.toLowerCase().includes(String(value).toLowerCase())
      );
      if (match) el.value = match.value;
    } else {
      // Simuler une saisie utilisateur (déclenche les événements React/Vue/etc.)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      );
      if (nativeInputValueSetter && el.tagName === 'INPUT') {
        nativeInputValueSetter.set.call(el, value);
      } else if (el.tagName === 'TEXTAREA') {
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        );
        if (nativeTextareaSetter) nativeTextareaSetter.set.call(el, value);
      } else {
        el.value = value;
      }
    }

    // Déclencher les événements pour les frameworks réactifs
    ['input', 'change', 'blur'].forEach(event => {
      el.dispatchEvent(new Event(event, { bubbles: true }));
    });

    el.classList.remove(DEVFILLER_HIGHLIGHT_CLASS);
    el.classList.add(DEVFILLER_FILLED_CLASS);
    count++;
  });
  return count;
}

function clearHighlights() {
  document.querySelectorAll(`.${DEVFILLER_HIGHLIGHT_CLASS}, .${DEVFILLER_FILLED_CLASS}`).forEach(el => {
    el.classList.remove(DEVFILLER_HIGHLIGHT_CLASS, DEVFILLER_FILLED_CLASS);
    delete el.dataset.devfillerId;
  });
}

// ─── Listener pour les messages du popup / background ─────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  injectStyles();

  if (message.action === 'PING') {
    sendResponse({ status: 'ok' });
    return true;
  }

  if (message.action === 'SCAN_FIELDS') {
    clearHighlights();
    const fields = extractFormFields();
    
    // Extraire le contexte additionnel de la page pour l'IA
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const mainHeading = document.querySelector('h1')?.innerText?.trim() || '';

    sendResponse({
      fields,
      pageUrl: window.location.href,
      pageTitle: document.title,
      pageDescription: metaDescription,
      pageHeading: mainHeading
    });
    return true;
  }

  if (message.action === 'APPLY_VALUES') {
    const count = applyValues(message.filledFields);
    hideToast();
    showToast(`✨ ${count} champ${count > 1 ? 's' : ''} rempli${count > 1 ? 's' : ''} avec succès !`, 'success');
    sendResponse({ success: true, count });
    return true;
  }

  if (message.action === 'SHOW_LOADING') {
    showToast(message.text || 'Analyse en cours...', 'loading');
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'SHOW_ERROR') {
    showToast(message.text || 'Une erreur est survenue.', 'error');
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'CLEAR') {
    clearHighlights();
    hideToast();
    sendResponse({ ok: true });
    return true;
  }
});

} // fin du guard __DEVFILLER_LOADED__
