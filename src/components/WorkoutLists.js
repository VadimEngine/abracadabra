import { useState, useRef } from 'react';
import './WorkoutLists.css';

function WorkoutLists({
  lists,
  activeListId,
  onSelectList,
  onCreateList,
  onRenameList,
  onDeleteList,
  onRemoveExercise,
  onReorderExercise,
  onStartWorkout,
}) {
  const [editingListId, setEditingListId] = useState(null);
  const [editName, setEditName] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const activeList = lists.find(l => l.id === activeListId) ?? lists[0];
  const exercises = activeList?.exercises ?? [];

  const startEdit = (list) => {
    setEditingListId(list.id);
    setEditName(list.name);
  };

  const commitEdit = () => {
    if (editName.trim()) onRenameList(editingListId, editName.trim());
    setEditingListId(null);
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(from) && from !== index) {
      onReorderExercise(activeList.id, from, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="lists-tab">
      {/* List selector row */}
      <div className="list-selector">
        <div className="list-chips-scroll">
          {lists.map(list => (
            <div key={list.id} className="list-chip-wrap">
              {editingListId === list.id ? (
                <input
                  className="list-name-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingListId(null);
                  }}
                  autoFocus
                />
              ) : (
                <button
                  className={`list-chip${list.id === activeListId ? ' active' : ''}`}
                  onClick={() => onSelectList(list.id)}
                >
                  {list.name}
                  {list.exercises.length > 0 && (
                    <span className="list-chip-count">{list.exercises.length}</span>
                  )}
                </button>
              )}
              {list.id === activeListId && editingListId !== list.id && (
                <button
                  className="list-chip-edit"
                  onClick={() => startEdit(list)}
                  aria-label="Rename list"
                >
                  ✏
                </button>
              )}
            </div>
          ))}
          <button className="list-add-btn" onClick={onCreateList} aria-label="New list">＋</button>
        </div>
      </div>

      {/* Exercise list */}
      <div className="list-exercises-card">
        {exercises.length === 0 ? (
          <div className="list-empty">
            <p>No exercises yet</p>
            <p className="list-empty-hint">Preview an exercise and tap "Add to List"</p>
          </div>
        ) : (
          <ul className="list-exercise-items">
            {exercises.map((ex, index) => (
              <li
                key={ex.uid}
                className={`list-exercise-item${dragIndex === index ? ' dragging' : ''}${dragOverIndex === index && dragIndex !== index ? ' drag-over' : ''}`}
                draggable="true"
                onDragStart={e => handleDragStart(e, index)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <span className="drag-handle">⠿</span>
                <img
                  src={process.env.PUBLIC_URL + ex.gif}
                  alt={ex.name}
                  className="list-exercise-thumb"
                />
                <span className="list-exercise-name">{ex.name}</span>
                <button
                  className="list-exercise-remove"
                  onClick={() => onRemoveExercise(activeList.id, ex.uid)}
                  aria-label={`Remove ${ex.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="list-actions">
        {lists.length > 1 && (
          <button className="list-delete-btn" onClick={() => onDeleteList(activeList.id)}>
            Delete List
          </button>
        )}
        <button
          className="start-workout-btn"
          disabled={exercises.length === 0}
          onClick={() => onStartWorkout(exercises)}
        >
          {exercises.length === 0
            ? 'Add exercises to start'
            : `Start Workout · ${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

export default WorkoutLists;
