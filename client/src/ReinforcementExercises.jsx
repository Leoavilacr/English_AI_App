import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ReinforcementExercises = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { errors = [], level, topic } = location.state || {};

  if (!errors.length) {
    return (
      <div>
        <p>No reinforcement exercises found. Please return to the conversation.</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Reinforcement Exercises for level {level}</h2>
      <h3>Topic: {topic}</h3>

      <p>Correct the following words or phrases:</p>

      <ul>
        {errors.map((err, idx) => (
          <li key={idx} style={{ marginBottom: '10px' }}>
            <strong>{err}</strong> — Write the correct form:
            <input type="text" placeholder="Your answer" style={{ marginLeft: '10px' }} />
          </li>
        ))}
      </ul>

      <button onClick={() => alert('Submit answers feature not implemented yet.')}>
        Submit Answers
      </button>

      <br />
      <br />

      <button onClick={() => navigate('/')}>Back to Conversation</button>
    </div>
  );
};

export default ReinforcementExercises;
