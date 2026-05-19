import React from "react";
import { createPortal } from "react-dom";
import { cx } from "classix";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalNode = (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className={cx("modal", className)}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            className="modal__close-btn"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="modal__content">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};

export default Modal;
