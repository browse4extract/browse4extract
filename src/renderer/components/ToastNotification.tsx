import React, { createContext, useContext, useState, useCallback, Fragment } from 'react';
import { Transition } from '@headlessui/react';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Add pulse-glow animation to document head
if (typeof document !== 'undefined') {
  const styleId = 'toast-glow-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse-glow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.15); }
      }
    `;
    document.head.appendChild(style);
  }
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, message, duration };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />;
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-blue-400" />;
    }
  };

  const getBackgroundColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-900/90 to-green-800/90 border-green-500/30';
      case 'error':
        return 'bg-gradient-to-r from-red-900/90 to-red-800/90 border-red-500/30';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-900/90 to-yellow-800/90 border-yellow-500/30';
      case 'info':
        return 'bg-gradient-to-r from-blue-900/90 to-blue-800/90 border-blue-500/30';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed bottom-0 right-0 flex flex-col-reverse items-end px-4 pb-4 space-y-reverse space-y-3 z-40"
        style={{ marginBottom: '8px' }}
      >
          {toasts.map((toast) => (
            <Transition
              key={toast.id}
              show={true}
              as={Fragment}
              enter="transform ease-out duration-300 transition"
              enterFrom="translate-x-full opacity-0 scale-95"
              enterTo="translate-x-0 opacity-100 scale-100"
              leave="transition ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95 translate-x-full"
            >
              <div
                className={`pointer-events-auto w-80 overflow-hidden rounded-lg border backdrop-blur-sm ${getBackgroundColor(toast.type)}`}
                style={{
                  boxShadow: toast.type === 'error'
                    ? '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(0, 0, 0, 0.5)'
                    : toast.type === 'success'
                    ? '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3), 0 4px 12px rgba(0, 0, 0, 0.5)'
                    : toast.type === 'warning'
                    ? '0 0 20px rgba(234, 179, 8, 0.5), 0 0 40px rgba(234, 179, 8, 0.3), 0 4px 12px rgba(0, 0, 0, 0.5)'
                    : '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0, 0, 0, 0.5)',
                  animation: 'pulse-glow 2s ease-in-out infinite'
                }}
              >
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {getIcon(toast.type)}
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium text-white">
                        {toast.message}
                      </p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0">
                      <button
                        type="button"
                        className="inline-flex rounded-md text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        onClick={() => removeToast(toast.id)}
                      >
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          ))}
      </div>
    </ToastContext.Provider>
  );
};
