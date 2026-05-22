/**
 * DevFiller — options.js
 * Logique de la page de configuration.
 */

// ─── Modèles par provider ───────────────────────────────────────────────────
const MODEL_GROUPS = {
  gemini: ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-pro', 'gemini-2.5-pro'],
  claude: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
};

const DEFAULT_MODELS = {
  gemini: 'gemini-3.5-flash',
  claude:  'claude-3-5-haiku-20241022',
  openai:  'gpt-4o-mini',
};

// ─── État ──────────────────────────────────────────────────────────────────
let currentProvider = 'gemini';
let currentLang     = 'auto';

// ─── Éléments DOM ──────────────────────────────────────────────────────────
const elApiKey    = document.getElementById('input-apikey');
const elModel     = document.getElementById('select-model');
const elContext   = document.getElementById('input-context');
const elToggleKey = document.getElementById('btn-toggle-key');
const elTestBtn   = document.getElementById('btn-test');
const elTestResult = document.getElementById('test-result');
const elSaveBtn   = document.getElementById('btn-save');
const elFeedback  = document.getElementById('save-feedback');

// ─── Provider selector ──────────────────────────────────────────────────────
document.querySelectorAll('.provider-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentProvider = btn.dataset.provider;
    document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateModelOptions();
  });
});

function updateModelOptions() {
  // Masquer tous les optgroup, afficher uniquement celui du provider sélectionné
  document.querySelectorAll('#select-model optgroup').forEach(g => {
    const providerName = currentProvider;
    if (g.className.includes(`model-group-${providerName}`)) {
      g.hidden = false;
    } else {
      g.hidden = true;
    }
  });

  // Sélectionner le modèle par défaut du provider
  elModel.value = DEFAULT_MODELS[currentProvider];
}

// ─── Language selector ──────────────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLang = btn.dataset.lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ─── Toggle visibilité clé API ──────────────────────────────────────────────
elToggleKey.addEventListener('click', () => {
  const isPassword = elApiKey.type === 'password';
  elApiKey.type = isPassword ? 'text' : 'password';
  document.getElementById('eye-icon').innerHTML = isPassword
    ? '<path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    : '<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="1.5"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" stroke-width="1.5"/>';
});

// ─── Test de connexion ──────────────────────────────────────────────────────
elTestBtn.addEventListener('click', async () => {
  const apiKey = elApiKey.value.trim();
  if (!apiKey) {
    showTestResult('Veuillez entrer une clé API avant de tester.', 'error');
    return;
  }

  elTestBtn.disabled = true;
  elTestBtn.textContent = 'Test en cours…';
  elTestResult.style.display = 'none';
  elTestResult.className = 'test-result';

  const testFields = [
    { devfillerId: 'test-0', type: 'text', label: 'Prénom', placeholder: '', name: 'firstname', id: '', required: true, options: [] },
    { devfillerId: 'test-1', type: 'email', label: 'Email', placeholder: '', name: 'email', id: '', required: true, options: [] },
  ];

  try {
    const res = await chrome.runtime.sendMessage({
      action:   'AI_FILL',
      fields:   testFields,
      provider: currentProvider,
      apiKey,
      model:    elModel.value,
      context:  'Test de connexion',
      lang:     'fr',
    });

    if (res.success && res.filledFields?.length > 0) {
      showTestResult(`✅ Connexion réussie ! Exemple : "${res.filledFields[0]?.value}"`, 'success');
    } else {
      throw new Error(res.error || 'Réponse vide');
    }
  } catch (err) {
    showTestResult('❌ Erreur : ' + err.message, 'error');
  } finally {
    elTestBtn.disabled = false;
    elTestBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Tester la connexion`;
  }
});

function showTestResult(text, type) {
  elTestResult.textContent = text;
  elTestResult.className = `test-result ${type}`;
}

// ─── Sauvegarde ────────────────────────────────────────────────────────────
elSaveBtn.addEventListener('click', async () => {
  const settings = {
    provider: currentProvider,
    apiKey:   elApiKey.value.trim(),
    model:    elModel.value,
    context:  elContext.value.trim(),
    lang:     currentLang,
  };

  await chrome.storage.local.set(settings);

  elFeedback.textContent = '✓ Paramètres enregistrés !';
  elFeedback.classList.add('visible');
  setTimeout(() => elFeedback.classList.remove('visible'), 3000);
});

// ─── Chargement initial des settings ───────────────────────────────────────
(async () => {
  const s = await chrome.storage.local.get(['provider', 'apiKey', 'model', 'context', 'lang']);

  // Provider
  if (s.provider) {
    currentProvider = s.provider;
    document.querySelectorAll('.provider-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.provider === s.provider);
    });
  }

  // Afficher uniquement les modèles du provider
  updateModelOptions();

  // Modèle
  if (s.model) elModel.value = s.model;

  // Clé API
  if (s.apiKey) elApiKey.value = s.apiKey;

  // Contexte
  if (s.context) elContext.value = s.context;

  // Langue
  if (s.lang) {
    currentLang = s.lang;
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === s.lang);
    });
  }
})();
