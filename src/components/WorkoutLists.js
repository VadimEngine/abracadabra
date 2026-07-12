import { useState, useRef } from 'react';
import './WorkoutLists.css';
import ExercisePreviewModal from './ExercisePreviewModal';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// How long to hold the drag handle before reorder mode activates.
const HOLD_DELAY_MS = 150;
// If the pointer moves more than this many px before the hold delay
// elapses, treat it as a scroll/tap instead of a drag.
const MOVE_CANCEL_PX = 6;

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
  selectedIds,
  onToggleSelected,
  onAddToList,
}) {
  const [editingListId, setEditingListId] = useState(null);
  const [editName, setEditName] = useState('');
  // dragIndex is the item's original index and never changes mid-gesture —
  // the underlying array is only reordered once, on release. dragOverIndex
  // is the live "slot" the drag would land on if released right now; other
  // rows shift visually (via CSS transform) to make room for it.
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragItemHeight, setDragItemHeight] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(null);
  const lastTapRef = useRef({ id: null, time: 0 });
  const dragStateRef = useRef({ holdTimer: null, pointerId: null, index: null, startY: 0, itemHeight: 0 });

  const activeList = lists.find(l => l.id === activeListId) ?? lists[0];
  const exercises = activeList?.exercises ?? [];

  const startEdit = (list) => {
    setEditingListId(list.id);
    setEditName(list.name);
  };

  const handleChipTap = (list) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === list.id && now - last.time < 350) {
      lastTapRef.current = { id: null, time: 0 };
      startEdit(list);
      return;
    }
    lastTapRef.current = { id: list.id, time: now };
    onSelectList(list.id);
  };

  const commitEdit = () => {
    if (editName.trim()) onRenameList(editingListId, editName.trim());
    setEditingListId(null);
  };

  const cancelHoldTimer = () => {
    if (dragStateRef.current.holdTimer) {
      clearTimeout(dragStateRef.current.holdTimer);
      dragStateRef.current.holdTimer = null;
    }
  };

  const endDrag = () => {
    cancelHoldTimer();
    dragStateRef.current.pointerId = null;
    setDragIndex(null);
    setDragOverIndex(null);
    setDragOffsetY(0);
    setDragItemHeight(0);
  };

  const handleHandlePointerDown = (e, index) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const itemEl = e.currentTarget.closest('.list-exercise-item');
    const itemHeight = itemEl?.offsetHeight || 44;
    dragStateRef.current = {
      holdTimer: null,
      pointerId: e.pointerId,
      index,
      startY: e.clientY,
      itemHeight,
    };
    dragStateRef.current.holdTimer = setTimeout(() => {
      dragStateRef.current.holdTimer = null;
      setDragIndex(index);
      setDragOverIndex(index);
      setDragItemHeight(itemHeight);
    }, HOLD_DELAY_MS);
  };

  const handleHandlePointerMove = (e) => {
    const state = dragStateRef.current;
    if (state.pointerId !== e.pointerId) return;
    const dy = e.clientY - state.startY;

    if (dragIndex === null) {
      // Still waiting out the hold delay — a real move means scroll/tap intent, not drag.
      if (Math.abs(dy) > MOVE_CANCEL_PX) cancelHoldTimer();
      return;
    }

    // Purely visual: the dragged row follows the finger and other rows
    // shift to make room, but the underlying list order never changes
    // mid-gesture (that would move the DOM node holding pointer capture,
    // which can leave the browser's pointer tracking stuck).
    setDragOffsetY(dy);
    if (!state.itemHeight) return;
    const shift = Math.round(dy / state.itemHeight);
    setDragOverIndex(clamp(state.index + shift, 0, exercises.length - 1));
  };

  const handleHandlePointerUp = (e) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    const from = dragStateRef.current.index;
    const to = dragOverIndex;
    endDrag();
    if (to !== null && to !== from) {
      onReorderExercise(activeList.id, from, to);
    }
  };

  const handleHandlePointerCancel = (e) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    endDrag();
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
                  onClick={() => handleChipTap(list)}
                >
                  {list.name}
                  {list.exercises.length > 0 && (
                    <span className="list-chip-count">{list.exercises.length}</span>
                  )}
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
            {exercises.map((ex, index) => {
              const isDragged = dragIndex === index;
              let shiftY = 0;
              if (!isDragged && dragIndex !== null && dragOverIndex !== null) {
                if (dragIndex < dragOverIndex && index > dragIndex && index <= dragOverIndex) {
                  shiftY = -dragItemHeight;
                } else if (dragIndex > dragOverIndex && index < dragIndex && index >= dragOverIndex) {
                  shiftY = dragItemHeight;
                }
              }
              return (
              <li
                key={ex.uid}
                className={`list-exercise-item${isDragged ? ' dragging' : ''}`}
                style={
                  isDragged ? { transform: `translateY(${dragOffsetY}px)` }
                  : shiftY !== 0 ? { transform: `translateY(${shiftY}px)` }
                  : undefined
                }
              >
                <span
                  className="drag-handle"
                  onPointerDown={e => handleHandlePointerDown(e, index)}
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={handleHandlePointerUp}
                  onPointerCancel={handleHandlePointerCancel}
                >
                  ⠿
                </span>
                <img
                  src={process.env.PUBLIC_URL + ex.gif}
                  alt={ex.name}
                  className="list-exercise-thumb"
                  onClick={() => setPreviewIndex(index)}
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
              );
            })}
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

      {/* Preview modal */}
      {previewIndex !== null && (
        <ExercisePreviewModal
          items={exercises}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          lists={lists}
          onAddToList={onAddToList}
        />
      )}
    </div>
  );
}

export default WorkoutLists;
