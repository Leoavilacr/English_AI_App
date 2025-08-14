// SplashScreen.jsx — estilo alineado con LiveSession
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SplashScreen = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Verifica si hay sesión activa
  useEffect(() => {
    fetch('http://localhost:3001/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data?.googleId) setUser(data);
      })
      .catch(() => {});
  }, []);

  // Cerrar sesión
  const handleLogout = () => {
    fetch('http://localhost:3001/auth/logout', { credentials: 'include' })
      .then(() => setUser(null))
      .catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-100 to-blue-200 py-8 px-4">
      <div className="w-full max-w-3xl mx-auto">
        {/* Card principal (match LiveSession) */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo.svg"
              alt="Speakly Logo"
              className="w-20 h-20 mb-3 drop-shadow-md"
            />
            <h1 className="text-xl font-bold text-blue-900">Welcome to Speakly</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Your path to fluent English starts here. Practice, improve, and track your progress effortlessly.
            </p>
          </div>

          {/* Línea divisoria suave */}
          <div className="mt-5 h-px w-full bg-gray-100" />

          {/* Contenido / Acciones */}
          <div className="mt-5">
            {user ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-blue-50 text-blue-900 border border-blue-100 rounded-lg px-4 py-2 text-sm">
                  👋 Welcome <span className="font-semibold">{user.name}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 w-full max-w-sm">
                  <button
                    onClick={() => navigate('/menu')}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg"
                  >
                    Go to Menu
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full bg-white text-gray-700 border border-gray-200 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <a
                  href="http://localhost:3001/auth/google"
                  className="flex items-center justify-center gap-2 w-full max-w-sm bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition shadow-md"
                >
                  <img
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google"
                    className="w-5 h-5"
                  />
                  Sign in with Google
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
