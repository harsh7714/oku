import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ToastContainer from '../components/ToastContainer';

const ToastContext = createContext();

let idCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => removeToast(id), duration);
      return id;
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (message, duration) => showToast(message, 'success', duration),
      error: (message, duration) => showToast(message, 'error', duration),
      info: (message, duration) => showToast(message, 'info', duration),
      warning: (message, duration) => showToast(message, 'warning', duration),
    }),
    [showToast]
  );

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext).toast;
