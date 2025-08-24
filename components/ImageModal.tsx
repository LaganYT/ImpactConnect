"use client";

import { useEffect } from "react";
import styles from "./ImageModal.module.css";

interface ImageModalProps {
  open: boolean;
  imageSrc: string;
  imageAlt?: string;
  onClose: () => void;
}

export default function ImageModal({
  open,
  imageSrc,
  imageAlt = "Image",
  onClose,
}: ImageModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.content}>
          <img
            src={imageSrc}
            alt={imageAlt}
            className={styles.image}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
