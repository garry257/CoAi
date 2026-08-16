import React, { useState, useEffect } from 'react';
import '../styles/InterviewTimer.css';

const InterviewTimer = ({ startedAt, totalSeconds, onTimeExpired }) => {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt)) / 1000);
      const newRemaining = Math.max(0, totalSeconds - elapsed);
      
      setRemaining(newRemaining);

      if (newRemaining === 0 && !isExpired) {
        setIsExpired(true);
        if (onTimeExpired) {
          onTimeExpired();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, totalSeconds, isExpired, onTimeExpired]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percentage = (remaining / totalSeconds) * 100;

  const getTimerClass = () => {
    if (remaining === 0) return 'timer-expired';
    if (percentage <= 10) return 'timer-critical';
    if (percentage <= 25) return 'timer-warning';
    return 'timer-normal';
  };

  return (
    <div className={`interview-timer ${getTimerClass()}`}>
      <div className="timer-display">
        <span className="timer-label">Time Remaining</span>
        <div className="timer-value">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>
      <div className="timer-bar">
        <div 
          className="timer-progress" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      {isExpired && (
        <div className="timer-message">Time's up! Please complete your answer.</div>
      )}
    </div>
  );
};

export default InterviewTimer;
