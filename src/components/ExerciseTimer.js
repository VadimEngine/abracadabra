import { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import completionMessages from '../data/completionMessages.json';
import './ExerciseTimer.css';

function buildPhases(workout, intervalTime, breakTime, restEnabled, restEvery, restTime) {
  const phases = [];
  const N = workout.length;

  for (let i = 0; i < N; i++) {
    const exercise = workout[i];

    phases.push({ type: 'getReady', duration: 5, exerciseIndex: i });

    if (exercise.twoPhase && intervalTime >= 10) {
      const half = Math.floor(intervalTime / 2);
      const rem  = intervalTime - half;
      phases.push({ type: 'work',   duration: half, exerciseIndex: i });
      phases.push({ type: 'switch', duration: 5,    exerciseIndex: i });
      phases.push({ type: 'work',   duration: rem,  exerciseIndex: i });
    } else {
      phases.push({ type: 'work', duration: intervalTime, exerciseIndex: i });
    }

    if (i < N - 1) {
      const round = i + 1;
      const isRestRound = restEnabled && restEvery > 0 && round % restEvery === 0;
      phases.push({
        type:     isRestRound ? 'rest' : 'break',
        duration: isRestRound ? restTime : breakTime,
        exerciseIndex: i,
      });
    }
  }

  return phases;
}

function ExerciseTimer({
  workout, intervalTime, breakTime, restEnabled, restEvery, restTime,
  voiceEnabled, voices, selectedVoiceURI, easterEgg,
}) {
  const phases = useMemo(
    () => buildPhases(workout, intervalTime, breakTime, restEnabled, restEvery, restTime),
    [workout, intervalTime, breakTime, restEnabled, restEvery, restTime]
  );

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(phases[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');

  const spokenPhaseRef = useRef(-1);

  // Voice config ref — reads latest settings without causing effect re-runs
  const voiceRef = useRef({ enabled: voiceEnabled, voices, uri: selectedVoiceURI });
  useEffect(() => {
    voiceRef.current = { enabled: voiceEnabled, voices, uri: selectedVoiceURI };
  }, [voiceEnabled, voices, selectedVoiceURI]);

  const speak = (text) => {
    const { enabled, voices: v, uri } = voiceRef.current;
    if (!enabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (uri && v.length > 0) {
      const voice = v.find(vv => vv.voiceURI === uri);
      if (voice) {
        u.voice = voice;
        u.lang  = voice.lang; // Android ignores u.voice but respects u.lang
      }
    }
    window.speechSynthesis.speak(u);
  };

  const { type: phaseType, exerciseIndex } = phases[phaseIndex];
  const currentExercise = workout[exerciseIndex];
  const nextExercise    = workout[exerciseIndex + 1];
  const roundNumber     = exerciseIndex + 1;

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;

    if (timeRemaining > 0) {
      const id = setInterval(() => setTimeRemaining(t => t - 1), 1000);
      return () => clearInterval(id);
    }

    if (phaseIndex < phases.length - 1) {
      const next = phaseIndex + 1;
      setPhaseIndex(next);
      setTimeRemaining(phases[next].duration);
    } else {
      setIsRunning(false);
      setIsFinished(true);
    }
  }, [isRunning, timeRemaining, phaseIndex, phases]);

  // Announce phase transitions
  useEffect(() => {
    if (!isRunning || isFinished) return;
    if (phaseIndex === spokenPhaseRef.current) return;
    spokenPhaseRef.current = phaseIndex;

    if (phaseType === 'getReady')        speak(currentExercise.name);
    else if (phaseType === 'work')       speak('Begin');
    else if (phaseType === 'switch')     speak('Switch sides');
    else if (phaseType === 'break')      speak('Break');
    else if (phaseType === 'rest')       speak('Rest');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isFinished, phaseIndex, phaseType, currentExercise]);

  // Countdown 3-2-1 during getReady
  useEffect(() => {
    if (!isRunning || phaseType !== 'getReady') return;
    if (timeRemaining >= 1 && timeRemaining <= 3) speak(String(timeRemaining));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phaseType, timeRemaining]);

  // Confetti + voice on completion
  useEffect(() => {
    if (!isFinished) return;
    const message = easterEgg
      ? 'Fuck you Bryce!'
      : completionMessages[Math.floor(Math.random() * completionMessages.length)];
    setCompletionMessage(message);
    speak(`Workout complete. ${message}`);
    const fire = () => confetti({ particleCount: 120, spread: 75, origin: { y: 0.55 } });
    
    // Fire immediately and then continuously every 500ms
    fire();
    const intervalId = setInterval(fire, 500);
    
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);

  const handleStart = () => {
    if (isFinished) {
      spokenPhaseRef.current = -1;
      setPhaseIndex(0);
      setTimeRemaining(phases[0].duration);
      setIsFinished(false);
    }
    if (isRunning) window.speechSynthesis?.cancel();
    setIsRunning(r => !r);
  };

  const handleReset = () => {
    window.speechSynthesis?.cancel();
    spokenPhaseRef.current = -1;
    setIsRunning(false);
    setPhaseIndex(0);
    setTimeRemaining(phases[0].duration);
    setIsFinished(false);
  };

  const phaseClass = isFinished            ? 'finished'  :
    phaseType === 'getReady'               ? 'get-ready' :
    phaseType === 'work'                   ? 'work'      :
    phaseType === 'switch'                 ? 'switch'    :
    phaseType === 'break'                  ? 'break'     : 'rest';

  const phaseLabel = isFinished            ? 'Done!'         :
    phaseType === 'getReady'               ? 'Get Ready'     :
    phaseType === 'work'                   ? 'Work'          :
    phaseType === 'switch'                 ? 'Switch Sides'  :
    phaseType === 'break'                  ? 'Break'         : 'Rest';

  const isGapPhase = phaseType === 'break' || phaseType === 'rest';

  return (
    <div className="workout-tab">
      <div className="exercise-display">
        {isFinished ? (
          <>
            <p className="done-text">Workout Complete!</p>
            {completionMessage && <p className="done-subtext">{completionMessage}</p>}
          </>
        ) : isGapPhase ? (
          nextExercise ? (
            <>
              <img
                src={process.env.PUBLIC_URL + nextExercise.gif}
                alt={nextExercise.name}
                className="exercise-gif break-gif"
              />
              <div className="break-banner">{phaseType === 'rest' ? 'Rest' : 'Break'}</div>
              <h2 className="exercise-name">Next: {nextExercise.name}</h2>
            </>
          ) : (
            <div className="gap-info">
              <p className="gap-heading">{phaseType === 'rest' ? 'Rest' : 'Break'}</p>
            </div>
          )
        ) : (
          <>
            <img
              src={process.env.PUBLIC_URL + currentExercise.gif}
              alt={currentExercise.name}
              className="exercise-gif"
            />
            {phaseType === 'getReady' ? (
              <div className="get-ready-banner">Get Ready</div>
            ) : phaseType === 'switch' ? (
              <div className="switch-banner">Switch Sides</div>
            ) : (
              <div className="work-banner">Work</div>
            )}
            <h2 className="exercise-name">{currentExercise.name}</h2>
          </>
        )}
      </div>

      <div className={`timer-display ${phaseClass}${isFinished ? ' pulse' : ''}`}>
        <div className="phase-label">{phaseLabel}</div>
        <div className="time-digits">{timeRemaining.toString().padStart(2, '0')}s</div>
        {!isFinished && (
          <div className="progress-label">{roundNumber} / {workout.length}</div>
        )}
      </div>

      <div className="timer-controls">
        <button className="ctrl-btn primary" onClick={handleStart}>
          {isRunning ? 'Pause' : isFinished ? 'Restart' : 'Start'}
        </button>
        <button className="ctrl-btn secondary" onClick={handleReset}>Reset</button>
      </div>
    </div>
  );
}

export default ExerciseTimer;
