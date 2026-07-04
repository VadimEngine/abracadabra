import { useState, useEffect, useRef } from 'react';
import './App.css';
import ExerciseSelector from './components/ExerciseSelector';
import ExerciseTimer from './components/ExerciseTimer';
import WorkoutLists from './components/WorkoutLists';
import exercises from './data/exercises.json';

const LS_EXCLUDED     = 'abra-excluded';
const LS_VOICE_ON     = 'abra-voice-enabled';
const LS_VOICE_URI    = 'abra-voice-uri';
const LS_EQUIPMENT    = 'abra-equipment';
const LS_INTERVAL     = 'abra-interval';
const LS_BREAK        = 'abra-break';
const LS_ROUNDS       = 'abra-rounds';
const LS_REST_ON      = 'abra-rest-enabled';
const LS_REST_EVERY   = 'abra-rest-every';
const LS_REST_TIME    = 'abra-rest-time';
const LS_LISTS        = 'abra-lists';
const LS_ACTIVE_LIST  = 'abra-active-list';

const APP_VERSION = '1.1.1';

const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const DEFAULT_LIST = { id: 'list-default', name: 'My Workout', exercises: [] };

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
  const [easterEgg, setEasterEgg] = useState(false);
  const titleTapCountRef = useRef(0);
  const titleTapTimerRef = useRef(null);

  const [workoutLists, setWorkoutLists] = useState(() => {
    const saved = lsGet(LS_LISTS, null);
    if (saved && Array.isArray(saved) && saved.length > 0) return saved;
    return [DEFAULT_LIST];
  });

  const [activeListId, setActiveListId] = useState(() => {
    const savedLists = lsGet(LS_LISTS, null);
    const lists = (savedLists && Array.isArray(savedLists) && savedLists.length > 0)
      ? savedLists : [DEFAULT_LIST];
    const savedId = lsGet(LS_ACTIVE_LIST, null);
    if (savedId && lists.some(l => l.id === savedId)) return savedId;
    return lists[0].id;
  });

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

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceDropOpen, setVoiceDropOpen] = useState(false);
  const voicePickerListRef = useRef(null);

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
    localStorage.setItem(LS_LISTS, JSON.stringify(workoutLists));
  }, [workoutLists]);

  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_LIST, JSON.stringify(activeListId));
  }, [activeListId]);

  // Close voice dropdown when settings panel closes
  useEffect(() => {
    if (!settingsOpen) setVoiceDropOpen(false);
  }, [settingsOpen]);

  // Scroll selected voice into view when dropdown opens
  useEffect(() => {
    if (!voiceDropOpen) return;
    const id = setTimeout(() => {
      const selected = voicePickerListRef.current?.querySelector('.voice-picker-item.selected');
      selected?.scrollIntoView({ block: 'nearest' });
    }, 0);
    return () => clearTimeout(id);
  }, [voiceDropOpen]);

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
    if (v) {
      u.voice = v;
      u.lang  = v.lang;
    }
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

  const addToList = (exercise) => {
    setWorkoutLists(prev => prev.map(list =>
      list.id === activeListId
        ? { ...list, exercises: [...list.exercises, { ...exercise, uid: randomId() }] }
        : list
    ));
  };

  const removeFromList = (listId, uid) => {
    setWorkoutLists(prev => prev.map(list =>
      list.id === listId
        ? { ...list, exercises: list.exercises.filter(e => e.uid !== uid) }
        : list
    ));
  };

  const reorderList = (listId, fromIndex, toIndex) => {
    setWorkoutLists(prev => prev.map(list => {
      if (list.id !== listId) return list;
      const exs = [...list.exercises];
      const [moved] = exs.splice(fromIndex, 1);
      exs.splice(toIndex, 0, moved);
      return { ...list, exercises: exs };
    }));
  };

  const createList = () => {
    const id = randomId();
    const name = `List ${workoutLists.length + 1}`;
    setWorkoutLists(prev => [...prev, { id, name, exercises: [] }]);
    setActiveListId(id);
  };

  const deleteList = (listId) => {
    setWorkoutLists(prev => {
      const next = prev.filter(l => l.id !== listId);
      if (next.length === 0) {
        const newId = randomId();
        setActiveListId(newId);
        return [{ id: newId, name: 'My Workout', exercises: [] }];
      }
      setActiveListId(cur => cur === listId ? next[0].id : cur);
      return next;
    });
  };

  const renameList = (listId, name) => {
    setWorkoutLists(prev => prev.map(l => l.id === listId ? { ...l, name } : l));
  };

  const startListWorkout = (exs) => {
    if (exs.length === 0) return;
    setWorkout(exs);
    setActiveTab('workout');
  };

  const handleTitleTap = () => {
    titleTapCountRef.current += 1;
    clearTimeout(titleTapTimerRef.current);

    if (titleTapCountRef.current >= 3) {
      setEasterEgg(e => !e);
      titleTapCountRef.current = 0;
      return;
    }

    titleTapTimerRef.current = setTimeout(() => {
      titleTapCountRef.current = 0;
    }, 1000);
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
        <h1 className={`app-title${easterEgg ? ' easter-egg' : ''}`} onClick={handleTitleTap}>
          Abracadabra
        </h1>
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
                <div className="voice-picker">
                  <button
                    className={`voice-picker-btn${voiceDropOpen ? ' open' : ''}`}
                    onClick={() => setVoiceDropOpen(v => !v)}
                  >
                    <span className="voice-picker-label">
                      {voices.find(v => v.voiceURI === selectedVoiceURI)?.name ?? 'Select voice…'}
                    </span>
                    <svg className="voice-picker-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {voiceDropOpen && (
                    <div className="voice-picker-list" ref={voicePickerListRef}>
                      {voices.length === 0 && (
                        <p className="voice-empty">No voices available</p>
                      )}
                      {voices.map(v => (
                        <button
                          key={v.voiceURI}
                          className={`voice-picker-item${v.voiceURI === selectedVoiceURI ? ' selected' : ''}`}
                          onClick={() => { setSelectedVoiceURI(v.voiceURI); setVoiceDropOpen(false); }}
                        >
                          <span className="voice-name">{v.name}</span>
                          <span className="voice-lang">{v.lang}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="settings-divider" />
            <div className="settings-version">Version {APP_VERSION}</div>
          </div>
        </>
      )}

      <main className="tab-content">
        {activeTab === 'setup' && (
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
            onAddToList={addToList}
            activeListName={workoutLists.find(l => l.id === activeListId)?.name ?? ''}
          />
        )}
        {activeTab === 'lists' && (
          <WorkoutLists
            lists={workoutLists}
            activeListId={activeListId}
            onSelectList={setActiveListId}
            onCreateList={createList}
            onRenameList={renameList}
            onDeleteList={deleteList}
            onRemoveExercise={removeFromList}
            onReorderExercise={reorderList}
            onStartWorkout={startListWorkout}
          />
        )}
        {activeTab === 'workout' && workout && (
          <ExerciseTimer
            key={workout.map(e => e.uid ?? e.id).join(',')}
            workout={workout}
            intervalTime={intervalTime}
            breakTime={breakTime}
            restEnabled={restEnabled}
            restEvery={restEvery}
            restTime={restTime}
            voiceEnabled={voiceEnabled}
            voices={voices}
            selectedVoiceURI={selectedVoiceURI}
            easterEgg={easterEgg}
          />
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
          className={`nav-btn ${activeTab === 'lists' ? 'active' : ''}`}
          onClick={() => setActiveTab('lists')}
        >
          Lists
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
