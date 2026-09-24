"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

let _idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 350);
  }, []);

  const addToast = useCallback(
    (message, type = "success", duration = 3000) => {
      const id = ++_idCounter;
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

      timersRef.current[id] = setTimeout(() => {
        dismiss(id);
        delete timersRef.current[id];
      }, duration);

      return id;
    },
    [dismiss]
  );

  // Cleanup on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* ─── UI ─────────────────────────────────────────────────────────────── */

const ICONS = {
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#22c55e" />
      <path
        d="M5.5 10.5l3 3 6-6"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#ef4444" />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#3b82f6" />
      <path
        d="M10 9v5M10 7v.01"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

function ToastContainer({ toasts, dismiss }) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 16px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          max-width: 340px;
          width: calc(100vw - 32px);
        }
        .toast-item {
          pointer-events: all;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 28px rgba(0,0,0,0.12);
          padding: 12px 14px;
          animation: toastIn 0.3s ease forwards;
        }
        .toast-item.exiting {
          animation: toastOut 0.3s ease forwards;
        }
        .toast-icon { flex-shrink: 0; margin-top: 1px; }
        .toast-msg {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          line-height: 1.45;
          word-break: break-word;
        }
        .toast-close {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          color: #9ca3af;
          line-height: 1;
          font-size: 18px;
          margin-top: -1px;
        }
        .toast-close:hover { color: #374151; }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(40px); }
        }
        @media (max-width: 480px) {
          .toast-container {
            top: 12px;
            right: 10px;
            left: 10px;
            width: auto;
            max-width: 100%;
          }
        }
      `}</style>
      <div className="toast-container" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-item${t.exiting ? " exiting" : ""}`}
            role="alert"
          >
            <span className="toast-icon">{ICONS[t.type] || ICONS.info}</span>
            <span className="toast-msg">{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
