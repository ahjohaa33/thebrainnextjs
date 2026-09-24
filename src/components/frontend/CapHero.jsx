"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./CapHero.module.css";

const AUTOPLAY_MS = 4800;
const DESKTOP_DRAG_THRESHOLD = 55;
const TOUCH_DRAG_THRESHOLD = 42;

function pad(value) {
  return String(value).padStart(2, "0");
}

export default function CapHero({ slides = [] }) {
  const items = useMemo(
    () => (Array.isArray(slides) ? slides.filter((item) => item?.image) : []),
    [slides]
  );
  const count = items.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [touchDragging, setTouchDragging] = useState(false);
  const rootRef = useRef(null);
  const progressRef = useRef(null);
  const pointerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pausedRef = useRef(paused);
  const draggingRef = useRef(dragging);
  const activeRef = useRef(active);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    draggingRef.current = dragging || touchDragging;
  }, [dragging, touchDragging]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (media.matches) setPaused(true);
    };
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const select = useCallback(
    (index) => {
      if (count < 1) return;
      const next = ((index % count) + count) % count;
      elapsedRef.current = 0;
      if (progressRef.current) {
        progressRef.current.style.transform = "scaleX(0)";
      }
      setActive(next);
    },
    [count]
  );

  useEffect(() => {
    if (count <= 1) return undefined;

    let frame = 0;
    lastTickRef.current = performance.now();

    const tick = (now) => {
      const delta = Math.min(now - lastTickRef.current, 120);
      lastTickRef.current = now;

      if (
        !pausedRef.current &&
        !draggingRef.current &&
        !document.hidden &&
        count > 1
      ) {
        elapsedRef.current += delta;
        if (elapsedRef.current >= AUTOPLAY_MS) {
          elapsedRef.current = 0;
          setActive((current) => (current + 1) % count);
        }
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${Math.min(
            1,
            elapsedRef.current / AUTOPLAY_MS
          )})`;
        }
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [count]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        select(activeRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        select(activeRef.current - 1);
      }
    };

    const root = rootRef.current;
    root?.addEventListener("keydown", onKeyDown);
    return () => root?.removeEventListener("keydown", onKeyDown);
  }, [select]);

  if (!count) return null;

  const activeItem = items[active] || items[0];

  function offsetFor(index) {
    let offset = (index - active + count) % count;
    if (offset > count / 2) offset -= count;
    return offset;
  }

  function beginPointer(event) {
    if (count < 2 || event.button !== 0) return;
    pointerRef.current = {
      id: event.pointerId,
      type: event.pointerType || "mouse",
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  function movePointer(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const isTouch = pointer.type === "touch";

    if (!pointer.moved) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
      pointer.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (isTouch) setTouchDragging(true);
      else setDragging(true);
    }

    if (pointer.moved) {
      const distance = isTouch ? Math.max(-95, Math.min(95, dx)) : dx;
      setDragX(distance);
    }
  }

  function endPointer(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const isTouch = pointer.type === "touch";
    const threshold = isTouch ? TOUCH_DRAG_THRESHOLD : DESKTOP_DRAG_THRESHOLD;
    const validSwipe =
      pointer.moved &&
      Math.abs(dx) >= threshold &&
      (!isTouch || Math.abs(dx) > Math.abs(dy) * 1.25);

    if (pointer.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    setDragX(0);
    setDragging(false);
    setTouchDragging(false);
    pointerRef.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (validSwipe) select(active + (dx < 0 ? 1 : -1));
  }

  function handleCardClick(event, index) {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (index !== active) {
      event.preventDefault();
      select(index);
    }
  }

  return (
    <section
      ref={rootRef}
      className={`${styles.hero} ${paused ? styles.paused : ""} ${
        dragging ? styles.dragging : ""
      } ${
        touchDragging ? styles.touchDragging : ""
      }`}
      data-cap-hero-nextjs
      aria-label="Featured cap collection"
      tabIndex={0}
    >
      <div
        className={styles.stage}
        aria-label="Featured products; drag left or right to explore"
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div className={styles.ring} aria-hidden="true" />
        {items.map((item, index) => {
          const offset = offsetFor(index);
          const centered = offset === 0;
          const near = Math.abs(offset) === 1;
          const isFar = !centered && !near;
          const travel = "var(--hero-travel)";
          const rotation = centered ? "-6deg" : offset < 0 ? "14deg" : "-16deg";
          const cardDrag = centered && touchDragging ? dragX : dragging ? dragX : 0;

          return (
            <a
              className={`${styles.product} ${centered ? styles.active : ""} ${
                near && !centered ? styles.side : ""
              } ${isFar ? styles.far : ""}`}
              href={item.url || "#"}
              key={item.id ?? `${item.name}-${index}`}
              aria-label={`View ${item.name || "featured product"}`}
              aria-hidden={isFar ? "true" : undefined}
              tabIndex={centered || near ? 0 : -1}
              onClick={(event) => handleCardClick(event, index)}
              draggable={false}
              style={{
                "--hero-x": `calc(${offset} * ${travel})`,
                "--hero-scale": centered ? 1 : 0.47,
                "--hero-rotation": rotation,
                "--hero-drag": `${cardDrag}px`,
              }}
            >
              <img
                src={item.image}
                alt={item.name || "Featured product"}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                draggable="false"
              />
            </a>
          );
        })}
      </div>

      <div className={styles.collection} aria-hidden="true">
        <span>01 / FEATURED</span>
        <strong>CAPS</strong>
        <small>
          THE BRAIN
          <br />
          SELECTION
        </small>
      </div>

      {count > 1 ? (
        <button
          className={styles.autoplay}
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? "Resume automatic rotation" : "Pause automatic rotation"}
        >
          <span />
          <span />
          <span />
        </button>
      ) : null}

      <div className={styles.details}>
        {count > 1 ? (
          <span className={styles.dragHint} aria-hidden="true">
            DRAG TO EXPLORE
          </span>
        ) : null}
        <div className={styles.copy} aria-live="polite">
          <p className={styles.index}>
            {pad(active + 1)} / {pad(count)}
          </p>
          <h1 key={`title-${active}`}>{activeItem.name}</h1>
          <p className={styles.subtitle}>
            {activeItem.model} · {activeItem.price_formatted}
          </p>
          <a className={styles.cta} href={activeItem.url || "#"}>
            SEE MORE
          </a>
        </div>
      </div>

      {count > 1 ? (
        <div className={styles.controls} aria-label="Featured product controls">
          <button type="button" onClick={() => select(active - 1)} aria-label="Previous product">
            ←
          </button>
          <div className={styles.dots}>
            {items.map((item, index) => (
              <button
                key={`dot-${item.id ?? index}`}
                type="button"
                className={index === active ? styles.dotActive : ""}
                aria-label={`Show ${item.name || `product ${index + 1}`}`}
                aria-pressed={index === active}
                onClick={() => select(index)}
              />
            ))}
          </div>
          <button type="button" onClick={() => select(active + 1)} aria-label="Next product">
            →
          </button>
        </div>
      ) : null}

      {count > 1 ? (
        <div className={styles.timeline} aria-hidden="true">
          <span ref={progressRef} />
        </div>
      ) : null}
    </section>
  );
}
