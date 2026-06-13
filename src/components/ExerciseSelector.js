import { useState, useEffect } from 'react';
import './ExerciseSelector.css';

function Stepper({ label, value, unit, onDecrement, onIncrement }) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper-control">
        <button className="stepper-btn" onClick={onDecrement}>−</button>
        <span className="stepper-value">{value}{unit}</span>
        <button className="stepper-btn" onClick={onIncrement}>+</button>
      </div>
    </div>
  );
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function ExerciseSelector({
  exercises,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  intervalTime,
  breakTime,
  onIntervalTimeChange,
  onBreakTimeChange,
  rounds,
  onRoundsChange,
  restEnabled,
  onRestEnabledChange,
  restEvery,
  onRestEveryChange,
  restTime,
  onRestTimeChange,
  allEquipment,
  enabledEquipment,
  onToggleEquipment,
  onGenerate,
  onAddToList,
  activeListName,
}) {
  const [previewExercise, setPreviewExercise] = useState(null);
  const [equipOpen, setEquipOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => { setAddedFeedback(false); }, [previewExercise]);

  // Only show exercises whose required equipment is currently enabled
  const visibleExercises = exercises.filter(e =>
    e.equipment.every(eq => enabledEquipment.has(eq))
  );

  const selectedVisibleCount = visibleExercises.filter(e => selectedIds.has(e.id)).length;
  const willGenerate = Math.min(rounds, selectedVisibleCount);

  // Equipment summary label for the trigger button
  const equipSummary = enabledEquipment.size === allEquipment.length
    ? 'All'
    : enabledEquipment.size === 0
      ? 'None'
      : `${enabledEquipment.size}/${allEquipment.length}`;

  return (
    <div className="setup-tab">
      {/* Timer settings */}
      <div className="setup-card">
        <button className="card-collapse-btn" onClick={() => setTimerOpen(o => !o)}>
          <span className="card-title">Timer</span>
          {!timerOpen && (
            <span className="timer-summary">
              {intervalTime}s work · {breakTime}s break
              {restEnabled ? ` · rest /${restEvery}` : ''}
            </span>
          )}
          <span className="card-chevron">{timerOpen ? '▴' : '▾'}</span>
        </button>

        {timerOpen && (
          <>
            <Stepper
              label="Work"
              value={intervalTime}
              unit="s"
              onDecrement={() => onIntervalTimeChange(t => clamp(t - 5, 5, 300))}
              onIncrement={() => onIntervalTimeChange(t => clamp(t + 5, 5, 300))}
            />
            <Stepper
              label="Break"
              value={breakTime}
              unit="s"
              onDecrement={() => onBreakTimeChange(t => clamp(t - 5, 5, 300))}
              onIncrement={() => onBreakTimeChange(t => clamp(t + 5, 5, 300))}
            />

            <div
              className="toggle-row"
              onClick={() => onRestEnabledChange(!restEnabled)}
            >
              <span className="stepper-label">Rest intervals</span>
              <div className={`toggle ${restEnabled ? 'on' : ''}`}>
                <div className="toggle-knob" />
              </div>
            </div>

            {restEnabled && (
              <>
                <Stepper
                  label="Rest every"
                  value={restEvery}
                  unit=" rds"
                  onDecrement={() => onRestEveryChange(r => clamp(r - 1, 2, 10))}
                  onIncrement={() => onRestEveryChange(r => clamp(r + 1, 2, 10))}
                />
                <Stepper
                  label="Rest time"
                  value={restTime}
                  unit="s"
                  onDecrement={() => onRestTimeChange(t => clamp(t - 5, 10, 300))}
                  onIncrement={() => onRestTimeChange(t => clamp(t + 5, 10, 300))}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Exercise list */}
      <div className="setup-card exercises-card">
        <div className="exercises-header">
          <span className="card-title">
            Exercises
            <span className="count-badge">{selectedVisibleCount} / {visibleExercises.length}</span>
          </span>
          <div className="select-btns">
            <button className="select-btn" onClick={onSelectAll}>All</button>
            <button className="select-btn" onClick={onDeselectAll}>None</button>
          </div>
        </div>

        {/* Equipment combobox */}
        {allEquipment.length > 0 && (
          <div className="equip-combobox">
            <button
              className={`equip-trigger${equipOpen ? ' open' : ''}`}
              onClick={() => setEquipOpen(o => !o)}
            >
              <span className="equip-trigger-label">Equipment</span>
              <span className={`equip-badge${enabledEquipment.size < allEquipment.length ? ' filtered' : ''}`}>
                {equipSummary}
              </span>
              <span className="equip-chevron">{equipOpen ? '▴' : '▾'}</span>
            </button>

            {equipOpen && (
              <div className="equip-options">
                {allEquipment.map(eq => (
                  <button
                    key={eq}
                    className={`equip-chip${enabledEquipment.has(eq) ? ' on' : ''}`}
                    onClick={() => onToggleEquipment(eq)}
                  >
                    <span className="equip-check">{enabledEquipment.has(eq) ? '✓' : ''}</span>
                    {eq}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Stepper
          label="Rounds"
          value={rounds}
          unit=""
          onDecrement={() => onRoundsChange(r => clamp(r - 1, 1, exercises.length))}
          onIncrement={() => onRoundsChange(r => clamp(r + 1, 1, exercises.length))}
        />

        <ul className="exercise-checklist">
          {visibleExercises.map(ex => {
            const checked = selectedIds.has(ex.id);
            return (
              <li
                key={ex.id}
                className={`check-item ${checked ? 'checked' : ''}`}
              >
                <div
                  className={`checkbox ${checked ? 'checked' : ''}`}
                  onClick={() => onToggle(ex.id)}
                >
                  {checked && <span className="check-mark">✓</span>}
                </div>
                <span className="check-label">{ex.name}</span>
                <img
                  src={process.env.PUBLIC_URL + ex.gif}
                  alt={ex.name}
                  className="exercise-thumb"
                  onClick={() => setPreviewExercise(ex)}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <button
        className="generate-btn"
        onClick={onGenerate}
        disabled={selectedVisibleCount === 0}
      >
        {selectedVisibleCount === 0
          ? 'Select at least one exercise'
          : `Shuffle Workout · ${willGenerate} exercise${willGenerate === 1 ? '' : 's'}`}
      </button>

      {/* Preview modal */}
      {previewExercise && (
        <div className="preview-overlay" onClick={() => setPreviewExercise(null)}>
          <div className="preview-card" onClick={e => e.stopPropagation()}>
            <img
              src={process.env.PUBLIC_URL + previewExercise.gif}
              alt={previewExercise.name}
              className="preview-gif"
            />
            <p className="preview-name">{previewExercise.name}</p>
            <p className="preview-equipment">
              {previewExercise.equipment.length > 0
                ? previewExercise.equipment.join(', ')
                : 'No equipment'}
            </p>
            {onAddToList && (
              <button
                className={`preview-add-btn${addedFeedback ? ' added' : ''}`}
                onClick={() => {
                  onAddToList(previewExercise);
                  setAddedFeedback(true);
                  setTimeout(() => setAddedFeedback(false), 1500);
                }}
              >
                {addedFeedback
                  ? '✓ Added'
                  : activeListName
                    ? `Add to "${activeListName}"`
                    : 'Add to List'}
              </button>
            )}
            <button
              className="preview-close"
              onClick={() => setPreviewExercise(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExerciseSelector;
