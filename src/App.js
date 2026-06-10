import { useState, useEffect } from 'react';
import './App.css';
import ExerciseSelector from './components/ExerciseSelector';
import ExerciseTimer from './components/ExerciseTimer';
import exercises from './data/exercises.json';

const LS_EXCLUDED     = 'abra-excluded';
const LS_VOICE_ON     = 'abra-voice-enabled';
const LS_VOICE_URI    = 'abra-voice-uri';
const LS_VOICE_LOCAL  = 'abra-voice-local';
const LS_EQUIPMENT    = 'abra-equipment';
const LS_INTERVAL     = 'abra-interval';
const LS_BREAK        = 'abra-break';
const LS_ROUNDS       = 'abra-rounds';
const LS_REST_ON      = 'abra-rest-enabled';
const LS_REST_EVERY   = 'abra-rest-every';
const LS_REST_TIME    = 'abra-rest-time';

// All unique equipment types found in the data
const ALL_EQUIPMENT = [...new Set(exercises.flatMap(e => e.equipment))].sort();

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}

// An exercise is available when every piece of its required equipment is enabled
const isAvailable = (enabledEquipment) => (e) =>
  e.equipment.every(eq => enabledEquipment.has(eq));

function App() {
  const [intervalTime, setIntervalTime] = useState(() => lsGet(LS_INTERVAL,   30));
  const [breakTime,    setBreakTime]    = useState(() => lsGet(LS_BREAK,       10));
  const [rounds,       setRounds]       = useState(() => lsGet(LS_ROUNDS,       5));
  const [restEnabled,  setRestEnabled]  = useState(() => lsGet(LS_REST_ON,  false));
  const [restEvery,    setRestEvery]    = useState(() => lsGet(LS_REST_EVERY,   3));
  const [restTime,     setRestTime]     = useState(() => lsGet(LS_REST_TIME,   60));
  const [workout, setWorkout] = useState(null);
  const [activeTab, setActiveTab] = useState('setup');

  // Persisted: excluded exercises
  const [selectedIds, setSelectedIds] = useState(() => {
    const excluded = new Set(lsGet(LS_EXCLUDED, []));
    return new Set(exercises.filter(e => !excluded.has(e.id)).map(e => e.id));
  });

  // Persisted: equipment filter (default: all enabled)
  const [enabledEquipment, setEnabledEquipment] = useState(() => {
    const saved = lsGet(LS_EQUIPMENT, null);
    return new Set(saved ?? ALL_EQUIPMENT);
  });

  // Persisted: voice settings
  const [voiceEnabled, setVoiceEnabled] = useState(() => lsGet(LS_VOICE_ON, true));
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => localStorage.getItem(LS_VOICE_URI) || '');
  const [localVoicesOnly, setLocalVoicesOnly] = useState(() => lsGet(LS_VOICE_LOCAL, false));

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Persistence effects ──────────────────────────────────────
  useEffect(() => {
    const excluded = exercises.filter(e => !selectedIds.has(e.id)).map(e => e.id);
    localStorage.setItem(LS_EXCLUDED, JSON.stringify(excluded));
  }, [selectedIds]);

  useEffect(() => { localStorage.setItem(LS_INTERVAL,   JSON.stringify(intervalTime)); }, [intervalTime]);
  useEffect(() => { localStorage.setItem(LS_BREAK,      JSON.stringify(breakTime));    }, [breakTime]);
  useEffect(() => { localStorage.setItem(LS_ROUNDS,     JSON.stringify(rounds));       }, [rounds]);
  useEffect(() => { localStorage.setItem(LS_REST_ON,    JSON.stringify(restEnabled));  }, [restEnabled]);
  useEffect(() => { localStorage.setItem(LS_REST_EVERY, JSON.stringify(restEvery));    }, [restEvery]);
  useEffect(() => { localStorage.setItem(LS_REST_TIME,  JSON.stringify(restTime));     }, [restTime]);

  useEffect(() => {
    localStorage.setItem(LS_EQUIPMENT, JSON.stringify([...enabledEquipment]));
  }, [enabledEquipment]);

  useEffect(() => {
    localStorage.setItem(LS_VOICE_ON, JSON.stringify(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    if (selectedVoiceURI) localStorage.setItem(LS_VOICE_URI, selectedVoiceURI);
  }, [selectedVoiceURI]);

  useEffect(() => {
    localStorage.setItem(LS_VOICE_LOCAL, JSON.stringify(localVoicesOnly));
  }, [localVoicesOnly]);

  // ── Load TTS voices ──────────────────────────────────────────
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (!v.length) return;
      setVoices(v);
      setSelectedVoiceURI(uri => {
        if (uri && v.some(vv => vv.voiceURI === uri)) return uri;
        const def = v.find(vv => vv.default) || v[0];
        return def?.voiceURI ?? '';
      });
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────
  const testVoice = () => {
    if (!('speechSynthesis' in window) || !voiceEnabled) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Side Bridge. 3, 2, 1. Begin! Switch sides.');
    const v = voices.find(vv => vv.voiceURI === selectedVoiceURI);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  const toggleExercise = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleEquipment = (eq) => {
    setEnabledEquipment(prev => {
      const next = new Set(prev);
      next.has(eq) ? next.delete(eq) : next.add(eq);
      return next;
    });
  };

  // All/None only affect exercises that are visible (equipment available)
  const selectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      exercises.filter(isAvailable(enabledEquipment)).forEach(e => next.add(e.id));
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      exercises.filter(isAvailable(enabledEquipment)).forEach(e => next.delete(e.id));
      return next;
    });
  };

  const generateWorkout = () => {
    const eligible = exercises.filter(e => selectedIds.has(e.id) && isAvailable(enabledEquipment)(e));
    if (eligible.length === 0) return;
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    setWorkout(shuffled.slice(0, Math.min(rounds, eligible.length)));
    setActiveTab('workout');
    setSettingsOpen(false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Abracadabra</h1>
        <button
          className={`hamburger-btn${settingsOpen ? ' open' : ''}`}
          onClick={() => setSettingsOpen(o => !o)}
          aria-label="Settings"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {settingsOpen && (
        <>
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)} />
          <div className="settings-panel">
            <div className="settings-row">
              <span className="settings-label">Voice cues</span>
              <div
                className={`toggle ${voiceEnabled ? 'on' : ''}`}
                onClick={() => setVoiceEnabled(v => !v)}
              >
                <div className="toggle-knob" />
              </div>
            </div>

            {voiceEnabled && (
              <>
                <div className="settings-divider" />
                <div className="settings-row">
                  <span className="settings-label-sm">Voice</span>
                  <button className="voice-test-btn" onClick={testVoice}>▶ Test</button>
                </div>
                <div className="settings-row">
                  <span className="settings-label-sm">Device voices only</span>
                  <div
                    className={`toggle toggle-sm ${localVoicesOnly ? 'on' : ''}`}
                    onClick={() => setLocalVoicesOnly(v => !v)}
                  >
                    <div className="toggle-knob" />
                  </div>
                </div>
                <div className="voice-list">
                  {voices.length === 0 && (
                    <p className="voice-empty">No voices available</p>
                  )}
                  {(localVoicesOnly ? voices.filter(v => v.localService) : voices).map(v => (
                    <button
                      key={v.voiceURI}
                      className={`voice-item${v.voiceURI === selectedVoiceURI ? ' selected' : ''}`}
                      onClick={() => setSelectedVoiceURI(v.voiceURI)}
                    >
                      <span className="voice-name">{v.name}</span>
                      <span className="voice-lang">{v.lang}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <main className="tab-content">
        {activeTab === 'setup' ? (
          <ExerciseSelector
            exercises={exercises}
            selectedIds={selectedIds}
            onToggle={toggleExercise}
            onSelectAll={selectAllVisible}
            onDeselectAll={deselectAllVisible}
            intervalTime={intervalTime}
            breakTime={breakTime}
            onIntervalTimeChange={setIntervalTime}
            onBreakTimeChange={setBreakTime}
            rounds={rounds}
            onRoundsChange={setRounds}
            restEnabled={restEnabled}
            onRestEnabledChange={setRestEnabled}
            restEvery={restEvery}
            onRestEveryChange={setRestEvery}
            restTime={restTime}
            onRestTimeChange={setRestTime}
            allEquipment={ALL_EQUIPMENT}
            enabledEquipment={enabledEquipment}
            onToggleEquipment={toggleEquipment}
            onGenerate={generateWorkout}
          />
        ) : (
          workout && (
            <ExerciseTimer
              key={workout.map(e => e.id).join(',')}
              workout={workout}
              intervalTime={intervalTime}
              breakTime={breakTime}
              restEnabled={restEnabled}
              restEvery={restEvery}
              restTime={restTime}
              voiceEnabled={voiceEnabled}
              voices={voices}
              selectedVoiceURI={selectedVoiceURI}
            />
          )
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-btn ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          Exercises
        </button>
        <button
          className={`nav-btn ${activeTab === 'workout' ? 'active' : ''}`}
          onClick={() => workout && setActiveTab('workout')}
          style={{ opacity: workout ? 1 : 0.3, cursor: workout ? 'pointer' : 'default' }}
        >
          Workout
        </button>
      </nav>
    </div>
  );
}

export default App;
