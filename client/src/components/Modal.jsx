import React from "react";

// Same markup as the original modal-overlay / modal-content blocks.
export default function Modal({ id, title, onClose, style, children, wide, className = "" }) {
  return (
    <div
      id={id}
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-content glass-card ${className}`} style={{ ...(wide ? { maxWidth: wide } : {}), ...style }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
