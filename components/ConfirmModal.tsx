"use client";

import { useState } from "react";
import Modal from "./Modal";
import styles from "./ConfirmModal.module.css";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "danger" | "warning" | "info";
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "info",
}: ConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.cancel}`}
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`${styles.button} ${styles.confirm} ${styles[type]}`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
