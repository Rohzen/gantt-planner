import React, { useState, useEffect } from 'react';
import { X, Database, Save, Trash2 } from 'lucide-react';

const OdooConfigDialog = ({ isOpen, onClose, onSave }) => {
  const [config, setConfig] = useState({
    url: '',
    database: '',
    username: '',
    apiKey: '',
    useCorsProxy: true,
    corsProxyUrl: 'https://corsproxy.io/?'
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Load saved config from localStorage
      const savedConfig = localStorage.getItem('odoo_config');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          setConfig(parsed);
        } catch (err) {
          console.error('Failed to load saved Odoo config:', err);
        }
      }
    }
  }, [isOpen]);

  const validateConfig = () => {
    const newErrors = {};

    if (!config.url.trim()) {
      newErrors.url = 'URL Odoo richiesto';
    } else if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      newErrors.url = 'URL deve iniziare con http:// o https://';
    }

    if (!config.database.trim()) {
      newErrors.database = 'Nome database richiesto';
    }

    if (!config.username.trim()) {
      newErrors.username = 'Username richiesto';
    }

    if (!config.apiKey.trim()) {
      newErrors.apiKey = 'API Key richiesta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateConfig()) {
      return;
    }

    // Remove trailing slash from URL if present
    const cleanConfig = {
      ...config,
      url: config.url.replace(/\/$/, '')
    };

    // Save to localStorage
    localStorage.setItem('odoo_config', JSON.stringify(cleanConfig));

    // Call the onSave callback
    onSave(cleanConfig);
    onClose();
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Sei sicuro di voler eliminare la configurazione Odoo salvata? Dovrai reinserire le credenziali la prossima volta.')) {
      localStorage.removeItem('odoo_config');
      setConfig({
        url: '',
        database: '',
        username: '',
        apiKey: '',
        useCorsProxy: true,
        corsProxyUrl: 'https://corsproxy.io/?'
      });
      alert('Configurazione eliminata con successo');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Configurazione Odoo</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL Istanza Odoo
            </label>
            <input
              type="text"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                errors.url ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="https://example.odoo.com"
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-600">{errors.url}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              URL dell'istanza Odoo (senza slash finale)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Database
            </label>
            <input
              type="text"
              value={config.database}
              onChange={(e) => setConfig({ ...config, database: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                errors.database ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="database_name"
            />
            {errors.database && (
              <p className="mt-1 text-sm text-red-600">{errors.database}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Nome del database Odoo
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username (Email)
            </label>
            <input
              type="text"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                errors.username ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="user@example.com"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Username o email per l'autenticazione
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                errors.apiKey ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="••••••••••••••••••••••••"
            />
            {errors.apiKey && (
              <p className="mt-1 text-sm text-red-600">{errors.apiKey}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              API Key da generare in Odoo: Preferenze Utente &gt; Sicurezza Account
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.useCorsProxy}
                onChange={(e) => setConfig({ ...config, useCorsProxy: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Usa CORS Proxy (⚠️ NON raccomandato)
              </span>
            </label>
            <div className="mt-2 ml-6 text-xs text-yellow-800 space-y-1">
              <p className="font-semibold">⚠️ IMPORTANTE: I proxy CORS pubblici NON funzionano con l'autenticazione Odoo!</p>
              <p>Le sessioni Odoo richiedono cookies che i proxy pubblici non possono inoltrare.</p>
              <p className="font-semibold mt-2">✅ SOLUZIONE CONSIGLIATA: Disabilita questa opzione e configura CORS sul tuo server Odoo:</p>
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Installa il modulo 'web_cors' su Odoo</li>
                <li>Aggiungi il tuo dominio alla whitelist CORS in Odoo</li>
                <li>Disabilita "Usa CORS Proxy" qui sotto</li>
              </ol>
              <p className="mt-2">📦 In alternativa: Usa il proxy personalizzato nella cartella 'cors-proxy' del progetto (vedi README)</p>
            </div>
          </div>

          {config.useCorsProxy && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL CORS Proxy
              </label>
              <input
                type="text"
                value={config.corsProxyUrl}
                onChange={(e) => setConfig({ ...config, corsProxyUrl: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="https://corsproxy.io/?"
              />
              <p className="mt-1 text-xs text-gray-500">
                Default: https://corsproxy.io/? | Per proxy personalizzato: vedi cartella cors-proxy
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>💾 Dove vengono salvati i dati?</strong>
            </p>
            <p className="text-sm text-blue-800">
              Le credenziali vengono salvate in modo <strong>sicuro e permanente</strong> nel localStorage del browser.
              Non dovrai reinserirle ogni volta che apri l'app. I dati rimangono salvati sul tuo computer e non vengono inviati a nessun server esterno.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>⚠️ Attenzione:</strong> Utilizza questa funzione solo su computer di fiducia e personali.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            title="Elimina configurazione salvata"
          >
            <Trash2 className="w-4 h-4" />
            Elimina Config
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Salva Configurazione
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OdooConfigDialog;
