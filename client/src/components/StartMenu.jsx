import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserStats from './UserStats';

const StartMenu = ({ user, level, topic, setLevel, setTopic }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { credentials: 'include' });
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleStartConversation = () => {
    if (level && topic) {
      navigate('/live-session', { state: { level, topic } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-100 to-blue-200 flex justify-center items-start py-10 px-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl p-6 sm:p-10 space-y-8 border border-gray-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-900">
            Welcome back, {user?.name || 'Leo'} 👋
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md"
          >
            Log out
          </button>
        </div>

        {/* Level selector */}
        <div>
          <label htmlFor="level-select" className="block text-sm font-medium text-gray-700 mb-1">
            Choose your English Level
          </label>
          <select
            id="level-select"
            value={level}
            onChange={e => setLevel(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">-- Select Level --</option>
            <optgroup label="Beginner">
              <option value="A1">A1 — Beginner</option>
              <option value="A2">A2 — Elementary</option>
            </optgroup>
            <optgroup label="Intermediate">
              <option value="B1">B1 — Intermediate</option>
              <option value="B2">B2 — Upper Intermediate</option>
            </optgroup>
            <optgroup label="Advanced">
              <option value="C1">C1 — Advanced</option>
            </optgroup>
          </select>
          {level && (
            <p className="mt-2 text-sm text-gray-600">
              {{
                A1: "Very basic sentences and expressions. Speak slowly and clearly.",
                A2: "Simple conversations about familiar topics like food or hobbies.",
                B1: "Can handle everyday interactions with some fluency.",
                B2: "Comfortable discussing a variety of topics with confidence.",
                C1: "Capable of discussing abstract topics and using idiomatic language."
              }[level]}
            </p>
          )}
        </div>

        {/* Topic selector */}
        <div>
          <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700 mb-1">
            Choose a Topic
          </label>
          <select
            id="topic-select"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">-- Select Topic --</option>
            <optgroup label="Daily Life">
              <option value="daily life">Daily Life</option>
              <option value="food">Food</option>
              <option value="work">Work</option>
              <option value="school">School</option>
            </optgroup>
            <optgroup label="Entertainment">
              <option value="movies">Movies</option>
              <option value="music">Music</option>
              <option value="video games">Video Games</option>
              <option value="comics">Comics</option>
            </optgroup>
            <optgroup label="Others">
              <option value="travel">Travel</option>
              <option value="sports">Sports</option>
              <option value="technology">Technology</option>
              <option value="relationships">Relationships</option>
              <option value="hobbies">Hobbies</option>
            </optgroup>
          </select>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col md:flex-row gap-4">
          <button
            onClick={handleStartConversation}
            disabled={!level || !topic}
            className={`flex-1 py-3 px-6 text-white font-semibold rounded-xl transition text-center text-base ${
              !level || !topic
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            🚀 Start Conversation
          </button>
          <button
            onClick={() => navigate('/sessions')}
            className="flex-1 py-3 px-6 border border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition"
          >
            📊 View Session History
          </button>
        </div>

        {/* Estadísticas del usuario */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl shadow-inner p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-blue-800">📈 Your Progress</h2>
            {level && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                Filter: Level {level}
              </span>
            )}
          </div>
          {user?.googleId ? (
            // Pasamos el nivel seleccionado para filtrar las estadísticas
            <UserStats googleId={user.googleId} selectedLevel={level} />
          ) : (
            <p className="text-sm text-gray-500 italic">Loading your stats...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartMenu;
