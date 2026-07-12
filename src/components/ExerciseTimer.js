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

// One segment per exercise (green), plus one extra segment for every gap
// between exercises — a rest (one color) or a plain break (another) — in
// playback order. Each segment's duration is the real total time it covers
// (an exercise segment sums getReady + work/switch legs), so the dial can
// size each wedge proportionally to how long it actually takes.
function buildDialSegments(phases) {
  const segments = [];
  for (const phase of phases) {
    if (phase.type === 'break' || phase.type === 'rest') {
      segments.push({ type: phase.type, exerciseIndex: phase.exerciseIndex, duration: phase.duration });
      continue;
    }
    const last = segments[segments.length - 1];
    if (last && last.type === 'exercise' && last.exerciseIndex === phase.exerciseIndex) {
      last.duration += phase.duration;
    } else {
      segments.push({ type: 'exercise', exerciseIndex: phase.exerciseIndex, duration: phase.duration });
    }
  }
  return segments;
}

function ExerciseTimer({
  workout, intervalTime, breakTime, restEnabled, restEvery, restTime,
  voiceEnabled, voices, selectedVoiceURI, easterEgg, isActive,
}) {
  const phases = useMemo(
    () => buildPhases(workout, intervalTime, breakTime, restEnabled, restEvery, restTime),
    [workout, intervalTime, breakTime, restEnabled, restEvery, restTime]
  );
  const dialSegments = useMemo(() => buildDialSegments(phases), [phases]);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(phases[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');
  const [flexFeedback, setFlexFeedback] = useState(false);

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

  // Countdown 3-2-1 during getReady, switch, and the final seconds of work
  useEffect(() => {
    if (!isRunning) return;
    if (phaseType !== 'getReady' && phaseType !== 'switch' && phaseType !== 'work') return;
    if (timeRemaining >= 1 && timeRemaining <= 3) speak(String(timeRemaining));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, phaseType, timeRemaining]);

  // Switching away to another tab pauses the timer but never resets it —
  // it stays mounted in the background so progress is preserved. Only the
  // Reset button or starting a new workout should clear it.
  useEffect(() => {
    if (!isActive && isRunning) {
      window.speechSynthesis?.cancel();
      setIsRunning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Pick the completion message + announce it (once per finish)
  useEffect(() => {
    if (!isFinished) return;
    const message = easterEgg
      ? 'Fuck you Bryce!'
      : completionMessages[Math.floor(Math.random() * completionMessages.length)];
    setCompletionMessage(message);
    speak(`Workout complete. ${message.replace(/-/g, '')}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  // Confetti only falls while the finished screen is actually visible —
  // switching tabs away stops it immediately.
  useEffect(() => {
    if (!isFinished || !isActive) return;
    const fire = () => confetti({ particleCount: 120, spread: 75, origin: { y: 0.55 } });

    // Fire immediately and then continuously every 500ms
    fire();
    const intervalId = setInterval(fire, 500);

    return () => clearInterval(intervalId);
  }, [isFinished, isActive]);

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

  const handleFlex = async () => {
    const text = `I just completed a ${workout.length} round workout with the Abracadabra app 💪`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* user cancelled share */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setFlexFeedback(true);
      setTimeout(() => setFlexFeedback(false), 1500);
    } catch { /* clipboard unavailable */ }
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

  // Dial segment status: 'done' (already passed), 'current' (happening
  // right now), or 'upcoming'. Once finished, everything reads as done.
  const getSegmentStatus = (seg) => {
    if (isFinished) return 'done';
    if (seg.exerciseIndex > exerciseIndex) return 'upcoming';
    if (seg.exerciseIndex < exerciseIndex) return 'done';
    // seg.exerciseIndex === exerciseIndex
    if (seg.type === 'rest' || seg.type === 'break') {
      return phaseType === seg.type ? 'current' : 'upcoming';
    }
    return isGapPhase ? 'done' : 'current';
  };

  // How much of the *current* segment's time has elapsed (0 = just started,
  // 1 = fully elapsed) — used to shrink it as a countdown. A rest/break
  // segment is one phase; an exercise segment spans getReady (+ switch/work
  // legs for a two-phase move), so those durations are combined into one
  // countdown.
  const getSegmentProgress = (seg) => {
    const currentPhase = phases[phaseIndex];
    if (currentPhase.exerciseIndex !== seg.exerciseIndex) return 0;

    if (seg.type === 'rest' || seg.type === 'break') {
      if (currentPhase.type !== seg.type) return 0;
      return Math.min(1, (currentPhase.duration - timeRemaining) / currentPhase.duration);
    }

    if (currentPhase.type === 'break' || currentPhase.type === 'rest') return 0;
    const roundPhases = phases.filter(p => p.exerciseIndex === seg.exerciseIndex && p.type !== 'break' && p.type !== 'rest');
    let elapsed = 0;
    for (const p of roundPhases) {
      if (p === currentPhase) {
        elapsed += p.duration - timeRemaining;
        break;
      }
      elapsed += p.duration;
    }
    return Math.min(1, elapsed / seg.duration);
  };

  return (
    <div className={`workout-tab${isActive ? '' : ' tab-hidden'}`}>
      <div className="exercise-display">
        {isFinished ? (
          <>
            <p className="done-text">Workout Complete!</p>
            {completionMessage && <p className="done-subtext">{completionMessage}</p>}
            <button className="flex-btn" onClick={handleFlex}>
              {flexFeedback ? '✓ Copied' : '💪 Flex'}
            </button>
          </>
        ) : isGapPhase ? (
          nextExercise ? (
            <>
              <img
                src={process.env.PUBLIC_URL + nextExercise.gif}
                alt={nextExercise.name}
                className="exercise-gif break-gif"
              />
              <div className={`break-banner${phaseType === 'rest' ? ' rest' : ''}`}>
                {phaseType === 'rest' ? 'Rest' : 'Break'}
              </div>
              <h2 className="exercise-name">Next: {nextExercise.name}</h2>
            </>
          ) : (
            <div className="gap-info">
              <p className={`gap-heading${phaseType === 'rest' ? ' rest' : ''}`}>
                {phaseType === 'rest' ? 'Rest' : 'Break'}
              </p>
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
            {currentExercise.twoPhase && intervalTime >= 10 && (
              <p className="two-phase-badge">Two-Phase · Switch Sides Halfway</p>
            )}
          </>
        )}
      </div>

      <div className="timer-dial">
        <svg className="timer-dial-ring" viewBox="0 0 100 100">
          {(() => {
            const radius = 46;
            const circumference = 2 * Math.PI * radius;

            // Each segment's angular width is proportional to how long it
            // actually takes, so a 60s exercise reads as a bigger wedge than
            // a 10s break, not an equal slice.
            const totalDuration = dialSegments.reduce((sum, s) => sum + s.duration, 0) || 1;
            const segAngles = dialSegments.map(s => (s.duration / totalDuration) * 360);
            const startAngles = [];
            let cursor = 0;
            for (const a of segAngles) {
              startAngles.push(cursor);
              cursor += a;
            }

            // A clearly visible gap between segments — a flat size (not
            // proportional to each segment's own width, since those now
            // vary a lot) so spacing stays consistent around the ring.
            const avgAngle = 360 / dialSegments.length;
            const gapDeg = Math.min(10, Math.max(2, avgAngle * 0.2));
            const minDrawDeg = 1.5; // never let a very short segment vanish entirely

            // Center the first segment on the top of the dial (rather than
            // starting it there) so the ring reads symmetrically at a glance.
            const rotation = -90 - segAngles[0] / 2;

            return (
              <>
                {/* Static gray track, always full-length, sits behind the
                    colored fill so shrinking/finished segments reveal it
                    instead of it "growing in" after the fact. */}
                {dialSegments.map((seg, i) => {
                  const drawLen = (Math.max(segAngles[i] - gapDeg, minDrawDeg) / 360) * circumference;
                  const dashOffset = -(startAngles[i] / 360) * circumference;
                  return (
                    <circle
                      key={`track-${i}`}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      strokeWidth="7"
                      strokeLinecap="butt"
                      strokeDasharray={`${drawLen} ${circumference - drawLen}`}
                      strokeDashoffset={dashOffset}
                      transform={`rotate(${rotation} 50 50)`}
                      className="dial-segment-track"
                    />
                  );
                })}
                {dialSegments.map((seg, i) => {
                  const status = getSegmentStatus(seg);
                  if (status === 'done') return null;
                  const drawLen = (Math.max(segAngles[i] - gapDeg, minDrawDeg) / 360) * circumference;
                  // Shrink the current segment as time runs out, eating into it
                  // from its start (counterclockwise edge) so the remaining arc
                  // keeps its end anchored — the vanishing edge sweeps clockwise,
                  // matching the direction segments are laid out around the dial.
                  const progress = status === 'current' ? getSegmentProgress(seg) : 0;
                  const liveDrawLen = drawLen * (1 - progress);
                  const dashOffset = -((startAngles[i] / 360) * circumference + progress * drawLen);
                  return (
                    <circle
                      key={`fill-${i}`}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      strokeWidth="7"
                      strokeLinecap="butt"
                      strokeDasharray={`${liveDrawLen} ${circumference - liveDrawLen}`}
                      strokeDashoffset={dashOffset}
                      transform={`rotate(${rotation} 50 50)`}
                      className={`dial-segment dial-segment-${seg.type} dial-segment-${status}`}
                    />
                  );
                })}
              </>
            );
          })()}
        </svg>
        <div className={`timer-display ${phaseClass}${isFinished ? ' pulse' : ''}`}>
          <div className="phase-label">{phaseLabel}</div>
          <div className="time-digits">{timeRemaining}</div>
        </div>
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
