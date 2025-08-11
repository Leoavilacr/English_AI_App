import React from 'react';
import { useNavigate } from 'react-router-dom';
import useSessionTracker from '../hooks/useSessionTracker';

const EndOfSession = ({ user, score }) => {
  const navigate = useNavigate();
  const trackSession = useSessionTracker(user.googleId);

  const correct = score.correct;
  const total = score.total;
  const mistakes = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const handleFinish = async () => {
    await trackSession(correct, mistakes);
    navigate('/start');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-blue-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full text-center space-y-4 border border-blue-100">
        <h2 className="text-2xl font-bold text-blue-700">Session Complete!</h2>
        <div className="text-left space-y-1">
          <p><strong>Correct Answers:</strong> {correct}</p>
          <p><strong>Mistakes:</strong> {mistakes}</p>
          <p><strong>Total Questions:</strong> {total}</p>
          <p><strong>Accuracy:</strong> {accuracy}%</p>
        </div>
        <button
          onClick={handleFinish}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Save and Continue
        </button>
      </div>
    </div>
  );
};

export default EndOfSession;
