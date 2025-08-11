import axios from 'axios';
import { useCallback } from 'react';

const useSessionTracker = (googleId) => {
  const trackSession = useCallback(async (correctAnswers, mistakes) => {
    if (!googleId) return;

    try {
      await axios.post('/api/user-stats/update', {
        googleId,
        correctAnswers,
        mistakes
      });

      console.log('✅ Session tracked successfully');
    } catch (error) {
      console.error('❌ Failed to track session:', error);
    }
  }, [googleId]);

  return trackSession;
};

export default useSessionTracker;
