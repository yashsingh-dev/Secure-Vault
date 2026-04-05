import { useState, useEffect } from 'react';
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
  HiOutlineXMark,
} from 'react-icons/hi2';

const iconMap = {
  success: HiOutlineCheckCircle,
  error: HiOutlineXCircle,
  warning: HiOutlineExclamationTriangle,
  info: HiOutlineInformationCircle,
};

const titleMap = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

export default function Toast({ id, message, type = 'info', onClose }) {
  const [exiting, setExiting] = useState(false);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(), 350); // matches CSS exit animation duration
  };

  // Auto-trigger exit animation slightly before removal for smooth UX
  useEffect(() => {
    return () => {}; // cleanup if needed
  }, []);

  const Icon = iconMap[type] || iconMap.info;

  return (
    <div
      className={`toast toast-${type} ${exiting ? 'toast-exit' : 'toast-enter'}`}
      role="alert"
    >
      <div className="toast-icon-wrapper">
        <Icon className="toast-icon" />
      </div>
      <div className="toast-body">
        <p className="toast-title">{titleMap[type]}</p>
        <p className="toast-message">{message}</p>
      </div>
      <button
        className="toast-close"
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        <HiOutlineXMark />
      </button>
      <div className="toast-progress">
        <div className={`toast-progress-bar toast-progress-${type}`} />
      </div>
    </div>
  );
}
