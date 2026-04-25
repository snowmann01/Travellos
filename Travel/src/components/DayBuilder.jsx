import React, { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function PoolCard({ place, index, readOnly }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${index}`,
    disabled: readOnly,
    data: { type: 'pool', index },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.7 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-left text-sm text-white shadow-sm"
    >
      <div className="flex items-start gap-2">
        {!readOnly && (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-cyan-300/80 hover:text-cyan-200"
            aria-label="Drag"
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{place.name}</p>
          {place.kinds && (
            <p className="mt-0.5 truncate text-[11px] text-cyan-100/60">{place.kinds}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableDayItem({ item, dayIndex, onRemove, readOnly }) {
  const id = item.instanceId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: readOnly,
    data: { type: 'day-item', dayIndex },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-cyan-500/20 bg-cyan-950/40 px-2 py-2 text-sm"
    >
      <div className="flex items-start gap-2">
        {!readOnly && (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-cyan-300/80"
            aria-label="Reorder"
            {...listeners}
            {...attributes}
          >
            ⠿
          </button>
        )}
        <div className="min-w-0 flex-1">
          {item.time && <span className="text-[11px] text-cyan-200/90">{item.time} · </span>}
          <span className="font-medium text-white">{item.name}</span>
          {item.notes && <p className="mt-0.5 text-[11px] leading-snug text-cyan-100/70">{item.notes}</p>}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onRemove(dayIndex, id)}
            className="shrink-0 text-[11px] text-rose-300 hover:text-rose-200"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function DayDropColumn({ dayIndex, items, onRemove, readOnly }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-drop-${dayIndex}`,
    data: { type: 'day-zone', dayIndex },
  });

  const ids = items.map((i) => i.instanceId);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[140px] w-[min(100%,260px)] shrink-0 flex-col rounded-xl border bg-black/25 p-2 ${
        isOver ? 'border-cyan-400/60 ring-2 ring-cyan-400/30' : 'border-white/10'
      }`}
    >
      <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-cyan-100/80">
        Day {dayIndex + 1}
      </h4>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableDayItem
              key={item.instanceId}
              item={item}
              dayIndex={dayIndex}
              onRemove={onRemove}
              readOnly={readOnly}
            />
          ))}
        </div>
      </SortableContext>
      {items.length === 0 && (
        <p className="mt-2 px-1 text-[11px] text-cyan-100/45">Drop places here</p>
      )}
    </div>
  );
}

export default function DayBuilder({
  suggestions = [],
  itemsByDay = [],
  onItemsByDayChange,
  readOnly = false,
}) {
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleRemove = (dayIndex, instanceId) => {
    onItemsByDayChange((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = next[dayIndex].filter((x) => x.instanceId !== instanceId);
      return next;
    });
  };

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveDrag(active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;

    if (String(active.id).startsWith('pool-')) {
      const poolIdx = Number(String(active.id).replace('pool-', ''));
      const place = suggestions[poolIdx];
      if (!place) return;

      let targetDay = null;
      if (String(over.id).startsWith('day-drop-')) {
        targetDay = Number(String(over.id).replace('day-drop-', ''));
      } else if (over.data?.current?.dayIndex !== undefined) {
        targetDay = over.data.current.dayIndex;
      }
      if (targetDay === null || Number.isNaN(targetDay)) return;
      onItemsByDayChange((prev) => {
        if (targetDay < 0 || targetDay >= prev.length) return prev;
        const next = prev.map((d) => [...d]);
        const copy = {
          ...place,
          instanceId: newId(),
          time: place.time || '',
          notes: place.notes || '',
        };
        next[targetDay] = [...next[targetDay], copy];
        return next;
      });
      return;
    }

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    onItemsByDayChange((prev) => {
      const findDay = (id) => {
        for (let d = 0; d < prev.length; d++) {
          if (prev[d].some((x) => x.instanceId === id)) return d;
        }
        return -1;
      };

      const sourceDay = findDay(activeId);
      if (sourceDay < 0) return prev;

      let targetDay = findDay(overId);
      if (targetDay < 0 && String(over.id).startsWith('day-drop-')) {
        targetDay = Number(String(over.id).replace('day-drop-', ''));
      }
      if (targetDay < 0) return prev;

      if (sourceDay === targetDay) {
        const col = prev[sourceDay];
        const oldIndex = col.findIndex((x) => x.instanceId === activeId);
        const newIndex = col.findIndex((x) => x.instanceId === overId);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const next = prev.map((d) => [...d]);
        next[sourceDay] = arrayMove(next[sourceDay], oldIndex, newIndex);
        return next;
      }

      const next = prev.map((d) => [...d]);
      const si = next[sourceDay].findIndex((x) => x.instanceId === activeId);
      if (si < 0) return prev;
      const [moved] = next[sourceDay].splice(si, 1);
      const ti = next[targetDay].findIndex((x) => x.instanceId === overId);
      if (ti >= 0) next[targetDay].splice(ti, 0, moved);
      else next[targetDay].push(moved);
      return next;
    });
  };

  const activePlace = (() => {
    if (!activeDrag) return null;
    if (String(activeDrag).startsWith('pool-')) {
      const i = Number(String(activeDrag).replace('pool-', ''));
      return suggestions[i] || null;
    }
    for (const col of itemsByDay) {
      const found = col.find((x) => x.instanceId === activeDrag);
      if (found) return found;
    }
    return null;
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-cyan-100">Suggestions</h3>
          <p className="mb-2 text-[11px] text-cyan-100/55">
            Drag a place into a day. Reorder stops within a day or move them between days.
          </p>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {suggestions.length === 0 && (
              <p className="text-sm text-cyan-100/50">Run a search above to load nearby POIs.</p>
            )}
            {suggestions.map((place, index) => (
              <PoolCard key={`${place.xid || place.name}-${index}`} place={place} index={index} readOnly={readOnly} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-cyan-100">Your days</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {itemsByDay.map((dayItems, dayIndex) => (
              <DayDropColumn
                key={`day-col-${dayIndex}`}
                dayIndex={dayIndex}
                items={dayItems}
                onRemove={handleRemove}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlace ? (
          <div className="rounded-xl border border-cyan-400/50 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-xl">
            {activePlace.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
