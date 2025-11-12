import React, { useEffect, useState } from 'react';
import { Minus, Maximize2, Minimize2, X, Shield } from 'lucide-react';

interface DebugTitleBarProps {
  securityLevel: 'relaxed' | 'normal' | 'strict' | 'paranoid';
}

const DebugTitleBar: React.FC<DebugTitleBarProps> = ({ securityLevel }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electronAPI.windowIsMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    await window.electronAPI.windowMinimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI.windowMaximize();
    const maximized = await window.electronAPI.windowIsMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = async () => {
    await window.electronAPI.windowClose();
  };

  // Get color for security level badge
  const getSecurityColor = () => {
    switch (securityLevel) {
      case 'relaxed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'normal': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'strict': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'paranoid': return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  return (
    <div
      className="h-8 bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-gray-700 flex items-center justify-between px-3 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Title with Security Badge */}
      <div className="flex items-center space-x-2 flex-1">
        <Shield className="w-4 h-4 text-yellow-400" />
        <span className="text-xs font-medium text-gray-200">
          Browse4Extract - Debug Tools
        </span>
        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getSecurityColor()}`}>
          {securityLevel.charAt(0).toUpperCase() + securityLevel.slice(1)}
        </span>
      </div>

      {/* Right: Window Controls */}
      <div
        className="flex items-center space-x-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="w-8 h-6 flex items-center justify-center hover:bg-gray-700/50 rounded transition-colors"
          title="Minimize"
        >
          <Minus className="w-4 h-4 text-gray-400" />
        </button>

        <button
          onClick={handleMaximize}
          className="w-8 h-6 flex items-center justify-center hover:bg-gray-700/50 rounded transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Minimize2 className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>

        <button
          onClick={handleClose}
          className="w-8 h-6 flex items-center justify-center hover:bg-red-600 rounded transition-colors group"
          title="Close"
        >
          <X className="w-4 h-4 text-gray-400 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
};

export default DebugTitleBar;
