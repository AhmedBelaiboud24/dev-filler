/**
 * DevFiller — popup.js
 * Logique du popup : scan, affichage des champs, déclenchement du remplissage.
 */

const PROVIDER_LABELS = {
  gemini: 'Gemini',
  claude: 'Claude',
  openai: 'OpenAI',
};

const TYPE_CLASSES = {
  text:     'type-text',
  email:    'type-email',
  tel:      'type-tel',
  phone:    'type-tel',
  password: 'type-password',
  select:   'type-select',
  textarea: 'type-textarea',
  number:   'type-number',
  date:     'type-date',
  url:      'type-url',
};

// ─── État global ────────────────────────────────────────────────────────────
let scannedFields = [];
let pageContext   = {};
let currentTab    = null;
let settings      = {};

// ─── Éléments DOM ──────────────────────────────────────────────────────────
const elStatus       = document.getElementById('status-text');
const elStatusBar    = document.getElementById('status-bar');
const elFieldsList   = document.getElementById('fields-list');
const elFieldsCount  = document.getElementById('fields-count');
const elProviderName = document.getElementById('provider-name');
const elProviderDot  = document.querySelector('.provider-dot');
const elBtnAI        = document.getElementById('btn-ai-fill');
const elBtnQuick     = document.getElementById('btn-quick-fill');
const elBtnSettings  = document.getElementById('btn-settings');
const elBtnRescan    = document.getElementById('btn-rescan');

// ─── Utilitaires ────────────────────────────────────────────────────────────
function setStatus(text, type = '') {
  elStatus.textContent = text;
  elStatusBar.className = 'status-bar' + (type ? ` ${type}` : '');
}

function renderFields(fields) {
  elFieldsCount.textContent = fields.length;

  if (fields.length === 0) {
    elFieldsList.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>Aucun formulaire détecté</p>
        <small>Naviguez vers une page avec un formulaire</small>
      </div>`;
    return;
  }

  elFieldsList.innerHTML = fields.map(f => {
    const typeClass = TYPE_CLASSES[f.type] || 'type-other';
    const label = f.label.length > 28 ? f.label.slice(0, 28) + '…' : f.label;
    const req = f.required ? '<span class="field-required" title="Champ requis">*</span>' : '';
    return `
      <div class="field-item">
        <span class="field-type-badge ${typeClass}">${f.type}</span>
        <span class="field-label" title="${f.label}">${label}</span>
        ${req}
      </div>`;
  }).join('');
}

function setButtonLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    const svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  } else {
    btn.classList.remove('loading');
  }
}

// ─── Scan du tab courant ────────────────────────────────────────────────────
async function scanCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      setStatus('⚠ Page système — impossible de scanner', 'warning');
      renderFields([]);
      return;
    }

    // Vérifier si le content script répond, sinon l'injecter manuellement
    // (cas des onglets ouverts avant le chargement de l'extension)
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'PING' });
    } catch (_) {
      // Pas de réponse → on injecte manuellement
      // Le guard dans content.js empêche la double exécution si déjà chargé
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch (injectErr) {
        setStatus('Impossible d\'accéder à cette page', 'error');
        return;
      }
    }

    setStatus('Scan du formulaire en cours…');


    const response = await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_FIELDS' });
    scannedFields = response?.fields || [];
    pageContext = {
      url: response?.pageUrl || '',
      title: response?.pageTitle || '',
      description: response?.pageDescription || '',
      heading: response?.pageHeading || ''
    };

    renderFields(scannedFields);

    if (scannedFields.length > 0) {
      setStatus(`${scannedFields.length} champ${scannedFields.length > 1 ? 's' : ''} trouvé${scannedFields.length > 1 ? 's' : ''}`, 'success');
      elBtnQuick.disabled = false;
      if (settings.apiKey) elBtnAI.disabled = false;
    } else {
      setStatus('Aucun champ de formulaire trouvé sur cette page');
      elBtnAI.disabled    = true;
      elBtnQuick.disabled = true;
    }
  } catch (err) {
    setStatus('Erreur lors du scan : ' + err.message, 'error');
    renderFields([]);
  }
}

// ─── Chargement des paramètres ──────────────────────────────────────────────
async function loadSettings() {
  settings = await chrome.storage.local.get(['provider', 'apiKey', 'model', 'context', 'lang']);

  const provider = settings.provider || 'gemini';
  elProviderName.textContent = PROVIDER_LABELS[provider] || provider;

  if (settings.apiKey) {
    elProviderDot.classList.add('active');
  } else {
    elProviderDot.classList.remove('active');
    // Insérer le bandeau d'avertissement si pas de clé
    showNoKeyBanner();
  }
}

function showNoKeyBanner() {
  if (document.getElementById('no-key-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'no-key-banner';
  banner.className = 'no-key-banner';
  banner.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    Clé API non configurée — cliquez ici
  `;
  banner.addEventListener('click', () => chrome.runtime.openOptionsPage());
  const actions = document.querySelector('.actions');
  actions.parentNode.insertBefore(banner, actions);
}

// ─── Remplissage IA ─────────────────────────────────────────────────────────
async function handleAIFill() {
  if (!scannedFields.length) return;

  setButtonLoading(elBtnAI, true);
  elBtnQuick.disabled = true;

  // Afficher loading sur la page
  await chrome.tabs.sendMessage(currentTab.id, {
    action: 'SHOW_LOADING',
    text: `Analyse IA en cours (${PROVIDER_LABELS[settings.provider || 'gemini']})…`,
  });

  try {
    const response = await chrome.runtime.sendMessage({
      action:   'AI_FILL',
      fields:   scannedFields,
      provider: settings.provider || 'gemini',
      apiKey:   settings.apiKey,
      model:    settings.model || undefined,
      context:  settings.context || '',
      pageContext: pageContext,
      lang:     settings.lang || 'auto',
    });

    if (!response.success) throw new Error(response.error);

    // Appliquer les valeurs sur la page
    await chrome.tabs.sendMessage(currentTab.id, {
      action:       'APPLY_VALUES',
      filledFields: response.filledFields,
    });

    setStatus(`✨ Remplissage IA terminé !`, 'success');
  } catch (err) {
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'SHOW_ERROR',
      text:   'Erreur IA : ' + err.message,
    });
    setStatus('Erreur : ' + err.message, 'error');
  } finally {
    setButtonLoading(elBtnAI, false);
    elBtnAI.disabled    = !settings.apiKey || !scannedFields.length;
    elBtnQuick.disabled = !scannedFields.length;
  }
}

// ─── Remplissage rapide ─────────────────────────────────────────────────────
async function handleQuickFill() {
  if (!scannedFields.length) return;

  setButtonLoading(elBtnQuick, true);
  elBtnAI.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'QUICK_FILL',
      fields: scannedFields,
    });

    if (!response.success) throw new Error(response.error);

    await chrome.tabs.sendMessage(currentTab.id, {
      action:       'APPLY_VALUES',
      filledFields: response.filledFields,
    });

    setStatus(`⚡ Remplissage rapide terminé !`, 'success');
  } catch (err) {
    setStatus('Erreur : ' + err.message, 'error');
  } finally {
    setButtonLoading(elBtnQuick, false);
    elBtnQuick.disabled = !scannedFields.length;
    elBtnAI.disabled    = !settings.apiKey || !scannedFields.length;
  }
}

// ─── Événements ─────────────────────────────────────────────────────────────
elBtnAI.addEventListener('click', handleAIFill);
elBtnQuick.addEventListener('click', handleQuickFill);
elBtnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());
elBtnRescan.addEventListener('click', scanCurrentTab);

// ─── Init ───────────────────────────────────────────────────────────────────
(async () => {
  await loadSettings();
  await scanCurrentTab();
})();
