"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import styles from "./InputModal.module.css";

interface InputModalProps {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  type?: "text" | "textarea";
  required?: boolean;
}

export default function InputModal({
  open,
  title,
  message,
  placeholder,
  defaultValue = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "text",
  required = false,
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

  const handleConfirm = async () => {
    if (required && !value.trim()) {
      return;
    }
    
    setIsLoading(true);
    try {
      await onConfirm(value.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className={styles.content}>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.inputContainer}>
          {type === "textarea" ? (
            <textarea
              className={styles.textarea}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={4}
              autoFocus
            />
          ) : (
            <input
              className={styles.input}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
            />
          )}
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.cancel}`}
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`${styles.button} ${styles.confirm}`}
            onClick={handleConfirm}
            disabled={isLoading || (required && !value.trim())}
          >
            {isLoading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
