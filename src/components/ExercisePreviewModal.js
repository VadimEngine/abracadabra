import { useState, useEffect, useRef } from 'react';
import './ExercisePreviewModal.css';

const SWIPE_THRESHOLD = 40;

function ExercisePreviewModal({
  items,
  index,
  onIndexChange,
  onClose,
  selectedIds,
  onToggleSelected,
  lists,
  onAddToList,
}) {
  const [addedFeedbackListId, setAddedFeedbackListId] = useState(null);
  const [previewDragX, setPreviewDragX] = useState(0);
  const [previewTransitioning, setPreviewTransitioning] = useState(false);
  const touchStartRef = useRef(null);
  const cardRef = useRef(null);
  const animatingRef = useRef(false);
  const addedFeedbackTimerRef = useRef(null);

  const item = items[index];

  useEffect(() => { setAddedFeedbackListId(null); }, [item]);
  useEffect(() => () => clearTimeout(addedFeedbackTimerRef.current), []);

  if (!item) return null;

  const handleAddToList = (listId) => {
    onAddToList(item, listId);
    clearTimeout(addedFeedbackTimerRef.current);
    setAddedFeedbackListId(listId);
    addedFeedbackTimerRef.current = setTimeout(() => setAddedFeedbackListId(null), 1200);
  };

  // Swipe left/right to move to the next/previous item
  const showOffset = (offset) => {
    if (items.length === 0) return;
    const nextIndex = (index + offset + items.length) % items.length;
    onIndexChange(nextIndex);
  };

  const handleTouchStart = (e) => {
    if (animatingRef.current) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setPreviewTransitioning(false);
  };

  const handleTouchMove = (e) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      setPreviewDragX(dx);
    }
  };

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const width = cardRef.current?.offsetWidth || window.innerWidth;

    setPreviewTransitioning(true);
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      // Fly the card fully off screen in the swipe direction; the swap
      // to the next/previous item happens once that animation ends.
      animatingRef.current = true;
      setPreviewDragX(dx < 0 ? -width : width);
    } else {
      setPreviewDragX(0);
    }
  };

  const handleTransitionEnd = () => {
    if (previewDragX === 0) {
      animatingRef.current = false;
      return;
    }
    const width = cardRef.current?.offsetWidth || window.innerWidth;
    const directionSign = previewDragX > 0 ? 1 : -1;
    showOffset(-directionSign);
    // Jump the incoming card just off-screen on the opposite side, then
    // slide it into place — the swipe motion, but with the next gif.
    setPreviewTransitioning(false);
    setPreviewDragX(-directionSign * width);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPreviewTransitioning(true);
        setPreviewDragX(0);
      });
    });
  };

  const isSelected = selectedIds?.has(item.id) ?? false;

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div
        className="preview-card"
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: `translateX(${previewDragX}px)`,
          transition: previewTransitioning ? 'transform 0.25s ease' : 'none',
        }}
      >
        <img
          src={process.env.PUBLIC_URL + item.gif}
          alt={item.name}
          className="preview-gif"
        />
        <div className="preview-name-row">
          {onToggleSelected && (
            <div
              className={`preview-checkbox${isSelected ? ' checked' : ''}`}
              onClick={() => onToggleSelected(item.id)}
              role="checkbox"
              aria-checked={isSelected}
              aria-label="In shuffle pool"
            >
              {isSelected && <span className="preview-check-mark">✓</span>}
            </div>
          )}
          <p className="preview-name">{item.name}</p>
        </div>
        <p className="preview-equipment">
          {item.equipment.length > 0 ? item.equipment.join(', ') : 'No equipment'}
        </p>

        {onAddToList && lists?.length > 0 && (
          <div className="preview-list-picker">
            <span className="preview-list-picker-label">Add to list</span>
            <div className="preview-list-options">
              {lists.map(list => {
                const count = list.exercises.filter(e => e.id === item.id).length;
                return (
                  <button
                    key={list.id}
                    className={`preview-list-option${addedFeedbackListId === list.id ? ' added' : ''}`}
                    onClick={() => handleAddToList(list.id)}
                  >
                    <span className="preview-list-option-name">{list.name}</span>
                    {count > 0 && <span className="preview-list-option-count">{count}</span>}
                    <span className="preview-list-option-icon">
                      {addedFeedbackListId === list.id ? '✓' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button className="preview-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default ExercisePreviewModal;
