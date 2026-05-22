# DevFiller — AI Form Filler 🪄

> Extension Chrome intelligente pour remplir automatiquement tous vos formulaires de test en cours de développement avec des données réalistes générées par IA (Gemini, Claude, OpenAI) et adaptées au contexte de la page web.

---

## ✨ Fonctionnalités

- **Remplissage IA** : Gemini, Claude ou OpenAI analysent les champs et génèrent des données cohérentes et réalistes
- **Remplissage adapté au contexte** : L'IA détecte l'URL, le titre et le contenu du site pour générer des messages et données en rapport avec le domaine du formulaire
- **Remplissage rapide** : Mode heuristique instantané, sans API, pour aller vite
- **Détection intelligente du DOM** : Labels, placeholders, `name`, `aria-label`... tout est analysé
- **Persona configurable** : Décrivez votre contexte pour des données encore plus pertinentes
- **Multi-provider** : Changez de provider en 1 clic depuis les paramètres
- **Clé API 100% locale** : Stockée dans `chrome.storage.local`, jamais dans le code

---

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/AhmedBelaiboud24/dev-filler.git
cd dev-filler
```

### 2. Charger l'extension dans Chrome

1. Ouvrez Chrome et naviguez vers `chrome://extensions`
2. Activez le **Mode développeur** (toggle en haut à droite)
3. Cliquez sur **"Charger l'extension non empaquetée"**
4. Sélectionnez le dossier `dev-filler/`

L'extension apparaît dans votre barre d'outils !

---

## 🔑 Configuration de la clé API

> ⚠️ **Votre clé API n'est jamais dans le code** — elle est stockée localement dans votre navigateur.

1. Cliquez sur l'icône DevFiller dans Chrome
2. Cliquez sur **"Paramètres"** (icône engrenage)
3. Choisissez votre provider IA : **Gemini**, **Claude** ou **OpenAI**
4. Collez votre clé API dans le champ prévu
5. Cliquez sur **"Tester la connexion"** pour vérifier
6. Cliquez sur **"Enregistrer"**

### Obtenir une clé API

| Provider | Lien | Tarif |
|----------|------|-------|
| **Gemini** | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Gratuit (quota généreux) |
| **Claude** | [console.anthropic.com](https://console.anthropic.com/) | Payant (essai gratuit) |
| **OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | Payant (essai gratuit) |

---

## 🧑‍💻 Utilisation

1. Naviguez vers une page avec un formulaire
2. Cliquez sur l'icône **DevFiller** dans la barre d'outils
3. L'extension scanne automatiquement les champs détectés
4. Choisissez :
   - **"Remplir avec l'IA"** → données intelligentes et contextualisées
   - **"Remplissage rapide"** → données prédéfinies instantanées

Les champs remplis sont surlignés en **vert** ✅

---

## ⚙️ Paramètres disponibles

| Paramètre | Description |
|-----------|-------------|
| **Provider IA** | Gemini / Claude / OpenAI |
| **Modèle** | Choix du modèle selon le provider |
| **Clé API** | Votre clé personnelle (privée) |
| **Persona / Contexte** | Description de votre profil de test |
| **Langue** | Automatique / Français / Anglais |

---

## 🔒 Sécurité & Confidentialité

- ✅ La clé API n'est **jamais** présente dans le code source
- ✅ Stockage exclusif dans `chrome.storage.local` (local à votre navigateur)
- ✅ Aucune donnée envoyée à des serveurs tiers (sauf l'API IA de votre choix)
- ✅ Le projet peut être mis sur GitHub public sans aucun risque

---

## 📁 Structure du projet

```
dev-filler/
├── manifest.json       # Configuration de l'extension (Manifest V3)
├── background.js       # Service worker — appels API IA
├── content.js          # Injection dans la page — analyse du DOM
├── popup/
│   ├── popup.html      # Interface principale
│   ├── popup.css       # Styles
│   └── popup.js        # Logique popup
├── options/
│   ├── options.html    # Page de configuration
│   ├── options.css
│   └── options.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🤝 Contribution

Les PRs sont les bienvenues ! Pour les grandes modifications, ouvrez d'abord une issue pour en discuter.

---

## 📄 Licence

MIT — Faites-en ce que vous voulez !
