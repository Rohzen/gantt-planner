import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

const PasswordAuth = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [configPassword, setConfigPassword] = useState('');

  useEffect(() => {
    // Load password from config.json in public folder
    // Using process.env.PUBLIC_URL for GitHub Pages compatibility
    const configPath = `${process.env.PUBLIC_URL}/config.json`;
    fetch(configPath)
      .then(response => {
        if (!response.ok) {
          throw new Error('Config file not found');
        }
        return response.json();
      })
      .then(data => {
        setConfigPassword(data.password || 'admin');
      })
      .catch(err => {
        console.error('Failed to load config:', err);
        setConfigPassword('admin'); // Fallback password
      });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password === configPassword) {
      setError('');
      // Store authentication in sessionStorage (expires when browser closes)
      sessionStorage.setItem('gantt_authenticated', 'true');
      onAuthenticated();
    } else {
      setError('Password non corretta');
      setPassword('');
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 p-4 rounded-full">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Gantt Planner
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Inserisci la password per accedere
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Inserisci la password"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Accedi
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            La password è configurabile nel file config.json
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordAuth;
