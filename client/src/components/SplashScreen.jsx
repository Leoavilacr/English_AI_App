import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SplashScreen = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Verifica si hay sesión activa
  useEffect(() => {
    fetch('http://localhost:3001/auth/me', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data?.googleId) {
          setUser(data);
        }
      });
  }, []);

  // Función para cerrar sesión
  const handleLogout = () => {
    fetch('http://localhost:3001/auth/logout', {
      credentials: 'include',
    }).then(() => {
      setUser(null);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center text-center px-4">
      <img
        src="/logo.svg"
        alt="Speakly Logo"
        className="w-24 h-24 mb-4"
      />
      <p className="text-base text-gray-600 mb-6 max-w-md">
        Your path to fluent English starts here.<br />
        Practice, improve, and track your progress effortlessly.
      </p>

      {user ? (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-lg text-gray-800">Welcome, {user.name} 👋</p>
          <button
            onClick={() => navigate('/menu')}
            className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Go to Menu
          </button>
          <button
            onClick={handleLogout}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Logout
          </button>
        </div>
      ) : (
        <a
          href="http://localhost:3001/auth/google"
          className="flex items-center justify-center border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 shadow-sm transition duration-150"
        >
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt="Google"
            className="w-5 h-5 mr-2"
          />
          Sign in with Google
        </a>
      )}
    </div>
  );
};

export default SplashScreen;
