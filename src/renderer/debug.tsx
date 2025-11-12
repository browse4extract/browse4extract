import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AdvancedLogsViewer from './components/AdvancedLogsViewer';
import DebugTitleBar from './components/DebugTitleBar';
import { AdvancedLogMessage } from '../types/types';
import './tailwind.css';

function DebugWindow() {
  const [logs, setLogs] = useState<AdvancedLogMessage[]>([]);
  const [securityLevel, setSecurityLevel] = useState<'relaxed' | 'normal' | 'strict' | 'paranoid'>('normal');

  useEffect(() => {
    // Load security level from settings
    const loadSecurityLevel = async () => {
      try {
        const settings = await window.electronAPI.getDebugSettings();
        setSecurityLevel(settings.securityLevel || 'normal');
      } catch (error) {
        console.error('Failed to load security level:', error);
      }
    };

    loadSecurityLevel();

    // Listen for advanced logs from main process
    const cleanup = window.electronAPI.onAdvancedLog((log: AdvancedLogMessage) => {
      setLogs(prev => [...prev, log]);
    });

    return cleanup;
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      <DebugTitleBar securityLevel={securityLevel} />
      <div className="flex-1 overflow-hidden">
        <AdvancedLogsViewer logs={logs} onClearLogs={handleClearLogs} />
      </div>
    </div>
  );
}

// Webpack will inject into <div id="root"> from index.html template
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<DebugWindow />);
}
