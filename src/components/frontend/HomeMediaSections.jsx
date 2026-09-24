"use client";

import { useState, useCallback } from "react";
import Script from "next/script";
import styles from "../../app/page.module.css";
import Link from "next/link";

/**
 * Extract an 11-char YouTube video id from a youtube-nocookie / youtube
 * embed URL (or any URL that already contains /embed/ID).
 */
function getYoutubeVideoId(embedUrl) {
  if (!embedUrl) return "";
  try {
    const url = new URL(embedUrl);
    if (url.pathname.includes("/embed/")) {
      const id = url.pathname.split("/embed/")[1]?.split(/[/?#]/)[0] || "";
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // ignore
  }
  return "";
}

function youtubeThumbnail(videoId, quality = "hqdefault") {
  if (!videoId) return "";
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

function ArrowIcon({ direction = "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function normalizeDate(value) {
  if (!value) return { iso: "", label: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { iso: String(value), label: String(value) };
  }
  return {
    iso: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
  };
}

/**
 * Lightweight video card surface.
 * - Default: same-origin <button> + thumbnail image (tap always reaches us).
 * - After tap: real iframe is mounted for this frameId only.
 * - Switching playingFrameId unmounts the previous iframe → playback stops.
 */
function LiteVideoFrame({ video, frameId, isPlaying, onPlay }) {
  const videoId = getYoutubeVideoId(video.embedUrl);
  const thumb = youtubeThumbnail(videoId);

  if (isPlaying) {
    return (
      <div className={styles.videoFrame}>
        <iframe
          id={frameId}
          src={video.embedUrl}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={styles.videoFrame}>
      <button
        type="button"
        className={styles.litePlayButton}
        onClick={() => onPlay(frameId)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={`Play ${video.title}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            width={480}
            height={270}
            loading="lazy"
            decoding="async"
            className={styles.liteThumb}
          />
        ) : (
          <span className={styles.liteThumbFallback} />
        )}
        <span className={styles.litePlayIcon} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
          </svg>
        </span>
      </button>
    </div>
  );
}

// const MEDIA_FILTERS = [
//   { value: "all", label: "Latest", icon: "✦" },
//   { value: "offer", label: "Offer", icon: "✹" },
//   { value: "shipment", label: "Shipment", icon: "▰" },
//   { value: "collaboration", label: "Collaboration", icon: "◈" },
//   { value: "event", label: "Event", icon: "▣" },
//   { value: "guideline", label: "Guideline", icon: "▥" },
//   { value: "achievement", label: "Achievement", icon: "♛" },
//   { value: "review", label: "Review", icon: "★" },
//   { value: "social-work", label: "Social Work", icon: "♥" },
// ];

function MediaVideoGallery({ videos, categories, playingFrameId, onPlay }) {
  if (!videos.length) return null;

  const filterTabs =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : MEDIA_FILTERS;

  return (
    <section
      id="ponnobd-video-gallery"
      className={styles.mediaGalleryPanel}
      aria-labelledby="media-gallery-heading"
      data-home-carousel
      data-start-index="0"
      data-carousel-kind="gallery"
      data-draggable="true"
    >
      <div className={styles.galleryToolbar}>
        <div
          className={styles.filterTabs}
          role="tablist"
          aria-label="Filter Ponnobd videos"
        >
        {filterTabs.map((filter, index) => {
          const isExternal = /^https?:\/\//i.test(filter.link);

          return isExternal ? (
            <a
              key={filter.title}
              href={filter.link}
              className={styles.filterTab}
            >
              <span aria-hidden="true"></span>
              {filter.title}
            </a>
          ) : (
            <Link
              key={filter.title}
              href={filter.link || "#"}
              className={styles.filterTab}
            >
              <span aria-hidden="true"></span>
              {filter.title}
            </Link>
          );
        })}
        </div>
      </div>

      <div className={styles.galleryCarouselShell}>
        <button
          className={`${styles.floatingArrow} ${styles.floatingArrowLeft}`}
          type="button"
          data-carousel-prev
          aria-label="Previous media item"
        >
          <ArrowIcon direction="left" />
        </button>

        <div className={styles.galleryViewport}>
          <div className={styles.galleryTrack} data-carousel-track>
            {videos.map((video, index) => {
              const date = normalizeDate(video.publishedAt);
              const frameId = `gallery-video-${video.id}`;

              return (
                <article
                  className={styles.mediaVideoCard}
                  key={video.id}
                  data-carousel-card
                  data-media-category={video.category}
                  data-active={index === 0 ? "true" : "false"}
                >
                  <LiteVideoFrame
                    video={video}
                    frameId={frameId}
                    isPlaying={playingFrameId === frameId}
                    onPlay={onPlay}
                  />
                  <div className={styles.mediaVideoBody}>
                    <span className={styles.mediaCategoryBadge}>
                      {video.categoryLabel}
                    </span>
                    <h3>{video.title}</h3>
                    {date.label ? (
                      <time dateTime={date.iso}>{date.label}</time>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <button
          className={`${styles.floatingArrow} ${styles.floatingArrowRight}`}
          type="button"
          data-carousel-next
          aria-label="Next media item"
        >
          <ArrowIcon direction="right" />
        </button>
      </div>
    </section>
  );
}

/**
 * Client boundary for the homepage media area (gallery only).
 * Owns the single `playingFrameId` so only one real iframe exists at a time.
 * Carousel drag / arrows / filters stay in the lightweight afterInteractive
 * script (DOM attributes are unchanged).
 */
export default function HomeMediaSections({ mediaVideos, categories }) {
  const [playingFrameId, setPlayingFrameId] = useState(null);

  const handlePlay = useCallback((frameId) => {
    setPlayingFrameId(frameId);
  }, []);

  if (!mediaVideos?.length) return null;

  return (
    <section className={styles.homeMediaArea} aria-label="Ponnobd media">
      <div className={styles.container}>
        <MediaVideoGallery
          videos={mediaVideos}
          categories={categories}
          playingFrameId={playingFrameId}
          onPlay={handlePlay}
        />
      </div>

      {/* Drag affordance only — scroll-snap / mobile snap-off live in CSS */}
      <style id="ponnobd-home-media-carousel-styles">{`
        [data-carousel-track] {
          cursor: grab;
          -webkit-user-select: none;
          user-select: none;
        }
        [data-home-carousel][data-dragging="true"] [data-carousel-track] {
          cursor: grabbing;
          scroll-behavior: auto;
          scroll-snap-type: none;
        }
        [data-home-carousel][data-dragging="true"] [data-carousel-card] {
          pointer-events: none;
        }
        [data-carousel-track] img,
        [data-carousel-track] iframe {
          -webkit-user-drag: none;
          user-drag: none;
        }
      `}</style>

      <Script id="ponnobd-home-media-carousel" strategy="afterInteractive">
        {`
          (() => {
            const visibleCards = (track) =>
              Array.from(track.querySelectorAll('[data-carousel-card]')).filter(
                (card) => !card.hidden
              );

            const nearestIndex = (track, cards) => {
              if (!cards.length) return -1;
              const center = track.scrollLeft + track.clientWidth / 2;
              let closestIndex = 0;
              let closestDistance = Number.POSITIVE_INFINITY;
              cards.forEach((card, index) => {
                const cardCenter = card.offsetLeft + card.offsetWidth / 2;
                const distance = Math.abs(cardCenter - center);
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestIndex = index;
                }
              });
              return closestIndex;
            };

            const scrollToCard = (track, card, smooth = true) => {
              if (!card) return;
              const left = Math.max(
                0,
                card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2
              );
              track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
            };

            const refreshRoot = (root) => {
              const track = root.querySelector('[data-carousel-track]');
              if (!track) return;
              const cards = visibleCards(track);
              const index = nearestIndex(track, cards);
              cards.forEach((card, cardIndex) => {
                card.dataset.active = cardIndex === index ? 'true' : 'false';
              });
              root.querySelectorAll('[data-carousel-dot]').forEach((dot, dotIndex) => {
                dot.dataset.active = dotIndex === index ? 'true' : 'false';
              });
            };

            const attachDragScroll = (root, track) => {
              let isDown = false;
              let hasDragged = false;
              let startX = 0;
              let startScrollLeft = 0;
              let pendingScrollLeft = null;
              let rafId = null;
              let momentumRafId = null;
              let lastMoveX = 0;
              let lastMoveTime = 0;
              let velocity = 0;

              const DRAG_THRESHOLD_PX = 4;
              const DRAG_SPEED_MULTIPLIER = 1.6;
              const VELOCITY_SMOOTHING = 0.75;
              const MOMENTUM_FRICTION = 0.94;
              const MOMENTUM_MIN_VELOCITY = 0.02;

              const stopMomentum = () => {
                if (momentumRafId !== null) {
                  window.cancelAnimationFrame(momentumRafId);
                  momentumRafId = null;
                }
              };

              const applyPendingScroll = () => {
                rafId = null;
                if (pendingScrollLeft === null) return;
                track.scrollLeft = pendingScrollLeft;
                pendingScrollLeft = null;
              };

              const beginDrag = (event) => {
                if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

                // Don't start dragging from interactive elements
                if (
                  event.target.closest(
                    'button, iframe, a, input, textarea, select, video'
                  )
                ) {
                  return;
                }

                stopMomentum();
                isDown = true;
                hasDragged = false;
                startX = event.clientX;
                startScrollLeft = track.scrollLeft;
                lastMoveX = event.clientX;
                lastMoveTime = event.timeStamp;
                velocity = 0;
                track.setPointerCapture(event.pointerId);
              };

              const duringDrag = (event) => {
                if (!isDown) return;
                const delta = event.clientX - startX;
                if (!hasDragged && Math.abs(delta) > DRAG_THRESHOLD_PX) {
                  hasDragged = true;
                  root.dataset.dragging = 'true';
                }
                if (hasDragged) {
                  event.preventDefault();
                  pendingScrollLeft = startScrollLeft - delta * DRAG_SPEED_MULTIPLIER;
                  if (rafId === null) {
                    rafId = window.requestAnimationFrame(applyPendingScroll);
                  }
                  const timeDelta = event.timeStamp - lastMoveTime;
                  if (timeDelta > 0) {
                    const instantVelocity = (event.clientX - lastMoveX) / timeDelta;
                    velocity =
                      velocity * (1 - VELOCITY_SMOOTHING) +
                      instantVelocity * VELOCITY_SMOOTHING;
                  }
                  lastMoveX = event.clientX;
                  lastMoveTime = event.timeStamp;
                }
              };

              const startMomentum = () => {
                let currentVelocity = velocity * DRAG_SPEED_MULTIPLIER;
                const step = () => {
                  currentVelocity *= MOMENTUM_FRICTION;
                  if (Math.abs(currentVelocity) < MOMENTUM_MIN_VELOCITY) {
                    momentumRafId = null;
                    delete root.dataset.dragging;
                    const cards = visibleCards(track);
                    scrollToCard(track, cards[nearestIndex(track, cards)], true);
                    return;
                  }
                  track.scrollLeft -= currentVelocity * 16.67;
                  momentumRafId = window.requestAnimationFrame(step);
                };
                momentumRafId = window.requestAnimationFrame(step);
              };

              const endDrag = (event) => {
                if (!isDown) return;
                isDown = false;
                if (rafId !== null) {
                  window.cancelAnimationFrame(rafId);
                  rafId = null;
                }
                applyPendingScroll();
                if (track.hasPointerCapture?.(event.pointerId)) {
                  track.releasePointerCapture(event.pointerId);
                }
                if (hasDragged) {
                  startMomentum();
                } else {
                  delete root.dataset.dragging;
                }
              };

              track.addEventListener('pointerdown', beginDrag);
              track.addEventListener('pointermove', duringDrag);
              track.addEventListener('pointerup', endDrag);
              track.addEventListener('pointercancel', endDrag);
              track.addEventListener('pointerleave', endDrag);
              track.addEventListener('dragstart', (event) => event.preventDefault());
            };

            const initRoot = (root) => {
              if (root.dataset.carouselReady === 'true') return;
              root.dataset.carouselReady = 'true';
              const track = root.querySelector('[data-carousel-track]');
              if (!track) return;

              let refreshScheduled = false;
              const scheduleRefresh = () => {
                if (refreshScheduled) return;
                refreshScheduled = true;
                window.requestAnimationFrame(() => {
                  refreshRoot(root);
                  refreshScheduled = false;
                });
              };

              const moveByOne = (direction) => {
                const cards = visibleCards(track);
                if (!cards.length) return;
                const current = nearestIndex(track, cards);
                const next = (current + direction + cards.length) % cards.length;
                scrollToCard(track, cards[next], true);
              };

              root.querySelectorAll('[data-carousel-prev]').forEach((button) => {
                button.addEventListener('click', () => moveByOne(-1));
              });
              root.querySelectorAll('[data-carousel-next]').forEach((button) => {
                button.addEventListener('click', () => moveByOne(1));
              });

              track.addEventListener('scroll', scheduleRefresh, { passive: true });
              window.addEventListener('resize', scheduleRefresh, { passive: true });

              if (root.dataset.draggable === 'true') {
                attachDragScroll(root, track);
              }

              const startIndex = Number.parseInt(root.dataset.startIndex || '0', 10);
              const initialCards = visibleCards(track);
              const initialCard =
                initialCards[Math.min(startIndex, initialCards.length - 1)];

              window.requestAnimationFrame(() => {
                scrollToCard(track, initialCard, false);
                refreshRoot(root);
              });
            };



            document.querySelectorAll('[data-home-carousel]').forEach(initRoot);
           
          })();
        `}
      </Script>
    </section>
  );
}
