import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StartMenu from './components/StartMenu';
import ChatBox from './ChatBox';
import ReinforcementExercises from './ReinforcementExercises';
import SessionViewer from './components/SessionViewer';
import SplashScreen from './components/SplashScreen';
import LiveSession from './components/LiveSession';

const AppRoutes = () => {
  const [level, setLevel] = useState('');
  const [topic, setTopic] = useState('');
  const [started, setStarted] = useState(false);
  const [user, setUser] = useState(null); // ✅ estado para el usuario

  const handleStart = () => {
    if (level && topic) setStarted(true);
  };

  // ✅ obtener el usuario autenticado al cargar
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/auth/user', { credentials: 'include' });
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    };

    fetchUser();
  }, []);

  return (
    <Routes>
      {/* Página inicial */}
      <Route path="/" element={<SplashScreen />} />

      {/* Menú principal */}
      <Route
        path="/menu"
        element={
          !started ? (
            <StartMenu
              user={user}
              level={level}
              topic={topic}
              setLevel={setLevel}
              setTopic={setTopic}
              onStart={handleStart}
            />
          ) : (
            <ChatBox level={level} topic={topic} />
          )
        }
      />

      {/* Live Session */}
      <Route path="/live-session" element={<LiveSession />} />

      {/* Otros módulos */}
      <Route path="/exercises" element={<ReinforcementExercises />} />
      <Route path="/sessions" element={<SessionViewer />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

export default App;
