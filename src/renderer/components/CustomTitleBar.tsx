import React, { useState, useEffect } from 'react';
import { Minus, X, Maximize2, Minimize2 } from 'lucide-react';

const CustomTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    const checkMaximized = async () => {
      const result = await window.electronAPI.windowIsMaximized();
      setIsMaximized(result.maximized);
    };
    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    await window.electronAPI.windowMinimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI.windowMaximize();
    const result = await window.electronAPI.windowIsMaximized();
    setIsMaximized(result.maximized);
  };

  const handleClose = async () => {
    await window.electronAPI.windowClose();
  };

  return (
    <div className="flex items-center justify-between h-8 bg-gradient-to-r from-purple-900 to-indigo-900 text-white select-none relative z-[9999]">
      {/* Draggable area */}
      <div
        className="flex-1 h-full flex items-center px-4 app-drag"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <img
          src={require('../assets/app_image.png')}
          alt="Logo"
          className="w-5 h-5 mr-3 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
        <span className="text-sm font-semibold text-white">Browse4Extract</span>
      </div>

      {/* Window controls */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="px-4 hover:bg-white/10 transition-colors h-full flex items-center justify-center"
          title="Minimize"
        >
          <Minus size={16} />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="px-4 hover:bg-white/10 transition-colors h-full flex items-center justify-center"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="px-4 hover:bg-red-600 transition-colors h-full flex items-center justify-center"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default CustomTitleBar;
