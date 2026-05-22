/**
 * DevFiller — background.js (Service Worker)
 * Gère les appels aux APIs IA (Gemini, Claude, OpenAI).
 * La clé API n'est jamais dans le code — elle est lue depuis chrome.storage.local.
 */

// ─── Constructeur de prompt ────────────────────────────────────────────────
function buildPrompt(fields, userContext, pageContext, lang) {
  const langHint = lang === 'fr' ? 'en français' : lang === 'en' ? 'in English' : 'in the most appropriate language';
  
  let contextBlock = '';
  if (userContext) {
    contextBlock += `\nProfil / Rôle de l'utilisateur : "${userContext}"\n`;
  }
  
  if (pageContext) {
    contextBlock += `\nContexte du site web détecté :`;
    if (pageContext.title) contextBlock += `\n- Titre du site : "${pageContext.title}"`;
    if (pageContext.heading) contextBlock += `\n- Titre de la page (H1) : "${pageContext.heading}"`;
    if (pageContext.description) contextBlock += `\n- Description du site (meta) : "${pageContext.description}"`;
    if (pageContext.url) {
      try {
        const domain = new URL(pageContext.url).hostname;
        contextBlock += `\n- Domaine/URL : "${domain}"`;
      } catch (e) {
        contextBlock += `\n- URL : "${pageContext.url}"`;
      }
    }
    contextBlock += `\n`;
  }

  return `Tu es un assistant de développement. Tu dois remplir des champs de formulaire web avec des données de test réalistes, extrêmement cohérentes et adaptées au contexte du site web.
${contextBlock}
Règles cruciales pour le contexte :
1. Analyse le contexte du site web fourni ci-dessus (domaine, titre, H1, description) pour comprendre l'activité du site (ex: atelier de confection de vêtements, boutique e-commerce, blog culinaire, logiciel professionnel, etc.).
2. Adapte le contenu de TOUS les champs en fonction de cette activité. Par exemple, si le site est un atelier de confection et qu'il y a un champ de message ou commentaire, génère un message réaliste en rapport direct avec de la couture, de la confection, des vêtements, des commandes de tissus ou des patrons. N'invente pas un message générique ou hors sujet (comme une demande de logiciel ou de dev).
3. Génère des données ${langHint} pour les champs suivants. Retourne UNIQUEMENT un tableau JSON valide, sans markdown ni explication.

Format attendu :
[
  { "devfillerId": "devfiller-0", "value": "valeur_générée" },
  ...
]

Champs à remplir :
${JSON.stringify(fields, null, 2)}

Règles importantes :
- Pour les champs "email" : génère un email valide (ex: jean.dupont@exemple.fr)
- Pour les champs "tel" / "phone" : génère un numéro valide selon le contexte
- Pour les champs "password" : génère un mot de passe fort (ex: TestDev@2024!)
- Pour les champs "date" : format YYYY-MM-DD
- Pour les champs "number" : un nombre cohérent avec le label
- Pour les <select> : utilise une des valeurs "value" listées dans options[]
- Sois cohérent entre tous les champs (même identité fictive tout au long)
- Ne génère pas de valeur pour les champs déjà pré-remplis

Retourne UNIQUEMENT le tableau JSON.`;
}

// ─── Appel Gemini ──────────────────────────────────────────────────────────
async function callGemini(apiKey, prompt, model = 'gemini-3.5-flash') {
  // Mapping des anciens modèles dépréciés vers les versions 2026 actives
  const modelMapping = {
    'gemini-1.5-flash-8b': 'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
    'gemini-1.5-flash': 'gemini-2.5-flash',
    'gemini-2.0-flash': 'gemini-3.5-flash',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-pro': 'gemini-3.1-pro'
  };

  const activeModel = modelMapping[model] || model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Appel Claude ──────────────────────────────────────────────────────────
async function callClaude(apiKey, prompt, model = 'claude-3-5-haiku-20241022') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude error ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ─── Appel OpenAI ──────────────────────────────────────────────────────────
async function callOpenAI(apiKey, prompt, model = 'gpt-4o-mini') {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Parse de la réponse IA ────────────────────────────────────────────────
function parseAIResponse(text) {
  // Nettoyer les balises markdown éventuelles
  const cleaned = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Trouver le tableau JSON
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Réponse IA invalide — aucun tableau JSON trouvé');

  return JSON.parse(match[0]);
}

// ─── Remplissage rapide (sans IA) ─────────────────────────────────────────
function quickFill(fields) {
  const names = ['Léa Martin', 'Thomas Dubois', 'Sarah Benali', 'Hugo Moreau', 'Emma Lefebvre'];
  const name = names[Math.floor(Math.random() * names.length)];
  const [firstName, lastName] = name.split(' ');
  const emailDomain = ['gmail.com', 'outlook.fr', 'yahoo.fr', 'example.com'];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain[Math.floor(Math.random() * emailDomain.length)]}`;

  return fields.map(f => {
    const label = (f.label + f.name + f.id + f.placeholder).toLowerCase();
    let value = '';

    if (/email|mail/.test(label)) value = email;
    else if (/prénom|firstname|first.name|prenom/.test(label)) value = firstName;
    else if (/nom|lastname|last.name|surname/.test(label)) value = lastName;
    else if (/name|nom/.test(label)) value = name;
    else if (/tel|phone|mobile|portable/.test(label)) value = '06 12 34 56 78';
    else if (/address|adresse|rue|street/.test(label)) value = '12 Rue de la Paix';
    else if (/city|ville/.test(label)) value = 'Paris';
    else if (/zip|postal|code.post/.test(label)) value = '75001';
    else if (/country|pays/.test(label)) value = 'France';
    else if (/company|entreprise|société/.test(label)) value = 'Acme Corp';
    else if (/message|commentaire|comment|description/.test(label)) value = 'Bonjour, je teste ce formulaire dans le cadre du développement. Ceci est un message de test généré automatiquement par DevFiller.';
    else if (/password|mot.de.passe/.test(label)) value = 'TestDev@2024!';
    else if (/age|âge/.test(label)) value = '28';
    else if (/date/.test(label)) value = '1996-03-15';
    else if (/price|prix|amount|montant/.test(label)) value = '49.99';
    else if (/url|site|website/.test(label)) value = 'https://example.com';
    else if (/title|titre/.test(label)) value = 'Développeur Full Stack';
    else if (f.type === 'select' && f.options.length > 0) {
      // Choisir une option non-vide aléatoire
      const validOpts = f.options.filter(o => o.value);
      value = validOpts[Math.floor(Math.random() * validOpts.length)]?.value || '';
    }
    else value = `Test ${f.label}`;

    return { devfillerId: f.devfillerId, value };
  });
}

// ─── Listener principal ────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'AI_FILL') {
    (async () => {
      try {
        const { fields, provider, apiKey, model, context, pageContext, lang } = message;

        const prompt = buildPrompt(fields, context, pageContext, lang);
        let rawText = '';

        if (provider === 'gemini') {
          rawText = await callGemini(apiKey, prompt, model);
        } else if (provider === 'claude') {
          rawText = await callClaude(apiKey, prompt, model);
        } else if (provider === 'openai') {
          rawText = await callOpenAI(apiKey, prompt, model);
        } else {
          throw new Error('Provider inconnu : ' + provider);
        }

        const filledFields = parseAIResponse(rawText);
        sendResponse({ success: true, filledFields });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indispensable pour les réponses asynchrones
  }

  if (message.action === 'QUICK_FILL') {
    try {
      const filledFields = quickFill(message.fields);
      sendResponse({ success: true, filledFields });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});
