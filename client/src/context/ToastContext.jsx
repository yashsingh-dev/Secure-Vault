import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);

      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  // Stable ref object so consumers never cause re-renders
  const api = useRef(null);
  if (!api.current) {
    api.current = {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }

  // Keep methods in sync with latest addToast
  api.current.success = (msg, duration) => addToast(msg, 'success', duration);
  api.current.error = (msg, duration) => addToast(msg, 'error', duration);
  api.current.warning = (msg, duration) => addToast(msg, 'warning', duration);
  api.current.info = (msg, duration) => addToast(msg, 'info', duration);

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
