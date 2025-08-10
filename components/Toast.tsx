"use client";

import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
  onClick?: () => void;
  clickable?: boolean;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking the close button
    if ((e.target as HTMLElement).closest(`.${styles.close}`)) {
      return;
    }
    
    if (toast.onClick && toast.clickable) {
      toast.onClick();
      onRemove(toast.id);
    }
  };

  return (
    <div 
      className={`${styles.toast} ${styles[toast.type]} ${toast.clickable ? styles.clickable : ''}`}
      onClick={handleClick}
    >
      <div className={styles.message}>{toast.message}</div>
      <button
        className={styles.close}
        onClick={() => onRemove(toast.id)}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Toast manager hook
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast["type"] = "info", duration?: number, onClick?: () => void, clickable?: boolean) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration, onClick, clickable };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (message: string, duration?: number, onClick?: () => void, clickable?: boolean) => addToast(message, "success", duration, onClick, clickable);
  const error = (message: string, duration?: number, onClick?: () => void, clickable?: boolean) => addToast(message, "error", duration, onClick, clickable);
  const info = (message: string, duration?: number, onClick?: () => void, clickable?: boolean) => addToast(message, "info", duration, onClick, clickable);
  const warning = (message: string, duration?: number, onClick?: () => void, clickable?: boolean) => addToast(message, "warning", duration, onClick, clickable);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };
}
