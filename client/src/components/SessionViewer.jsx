import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionViewer = () => {
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error('Error loading sessions:', err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Volver */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate('/menu')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          ← Back to Start
        </button>
      </div>

      <h1 className="text-3xl font-bold text-blue-700 text-center mb-8">Your Conversation Sessions</h1>

      {sessions.length === 0 ? (
        <p className="text-center text-gray-500">No sessions found.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 max-w-7xl mx-auto">
          {sessions.map((s, idx) => (
            <div key={idx} className="bg-white shadow-lg rounded-xl p-6 border border-gray-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-blue-800">Session ID: {s.sessionId}</h2>
                <span className="text-xs text-gray-500">Level: {s.level}</span>
              </div>
              <p className="text-sm text-gray-600 italic">Topic: {s.topic}</p>

              {/* Conversación */}
              <div className="text-sm bg-gray-50 border border-gray-200 rounded-md p-3">
                <strong className="text-gray-700 block mb-1">Conversation:</strong>
                {(() => {
                  try {
                    const parsed = JSON.parse(s.messages);
                    return parsed.map((m, i) => (
                      <p key={i}>
                        <strong>{m.role.toUpperCase()}:</strong> {m.content}
                      </p>
                    ));
                  } catch (err) {
                    return <p className="text-red-600 italic">❌ Invalid or missing conversation data.</p>;
                  }
                })()}
              </div>

              {/* Feedback */}
              <div className="text-sm bg-green-50 border border-green-200 rounded-md p-3">
                <strong className="text-green-700 block mb-1">Feedback:</strong>
                <p className="text-green-800 whitespace-pre-wrap">{s.feedback}</p>
              </div>

              {/* Ejercicios */}
              <div className="text-sm bg-purple-50 border border-purple-200 rounded-md p-3">
                <strong className="text-purple-700 block mb-1">Reinforcement Exercises:</strong>
                <p className="text-purple-800 whitespace-pre-wrap">{s.reinforcement}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionViewer;
