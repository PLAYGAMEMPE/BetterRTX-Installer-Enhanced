import React, { useEffect, useState } from "react";
import { X, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { cx } from "classix";
import { useStatusStore, StatusMessage } from "../store/statusStore";

const StatusIcon: React.FC<{ type: StatusMessage["type"] }> = ({ type }) => {
  switch (type) {
    case "error":
      return <AlertTriangle size={16} className="text-danger" />;
    case "success":
      return <CheckCircle size={16} className="text-success" />;
    case "loading":
      return (
        <div className="progress-spinner w-4 h-4 border-2 rounded-full animate-spin border-app-border border-t-brand-accent-600" />
      );
    default:
      return <Info size={16} className="text-info" />;
  }
};

const StatusToast: React.FC<{
  message: StatusMessage;
  onDismiss: (id: string) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}> = ({ message, onDismiss, onMouseEnter, onMouseLeave }) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = (): void => {
    setIsVisible(false);
    setTimeout(() => onDismiss(message.id), 200);
  };

  return (
    <div
      className={cx(
        "status-alert bg-app-panel border-app-border transition-all duration-200 ease-in-out transform",
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
      )}
      role="alert"
      onMouseEnter={() => onMouseEnter(message.id)}
      onMouseLeave={() => onMouseLeave(message.id)}
    >
      <StatusIcon type={message.type} />
      <span className="status-message flex-1 text-sm text-app-fg">
        {message.message}
      </span>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-full hover:bg-app-bg transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const StatusBarContainer: React.FC = () => {
  const { messages, removeMessage, clearTimer } = useStatusStore();

  const handleMouseEnter = (id: string): void => {
    clearTimer(id);
  };

  const handleMouseLeave = (id: string): void => {
    const message = messages.find((msg) => msg.id === id);
    if (message && message.type !== "loading") {
      setTimeout(() => {
        removeMessage(id);
      }, 5000);
    }
  };

  return (
    <div className="fixed bottom-12 right-4 z-40 flex flex-col items-end gap-2 max-w-sm">
      {messages
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((msg) => (
          <StatusToast
            key={msg.id}
            message={msg}
            onDismiss={removeMessage}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ))}
    </div>
  );
};
