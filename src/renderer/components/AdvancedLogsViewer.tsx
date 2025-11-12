import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { AdvancedLogMessage, LogCategory } from '../../types/types';

interface AdvancedLogsViewerProps {
  logs: AdvancedLogMessage[];
  onClearLogs: () => void;
}

const AdvancedLogsViewer: React.FC<AdvancedLogsViewerProps> = ({ logs, onClearLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState<Record<LogCategory, boolean>>({
    'nodejs': true,
    'electron': true,
    'puppeteer': true,
    'Browse4Extract': true
  });

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle manual scroll - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  // Filter logs based on category, level, and search term
  const filteredLogs = logs.filter(log => {
    // Category filter
    if (!filters[log.category]) return false;

    // Search filter
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Toggle category filter
  const toggleFilter = (category: LogCategory) => {
    setFilters(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Export logs to file
  const exportLogs = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `browse4extract_logs_${timestamp}.txt`;

    const content = filteredLogs
      .map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `[${time}] [${log.category.toUpperCase()}/${log.level.toUpperCase()}] ${log.message}`;
      })
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get color for category
  const getCategoryColor = (category: LogCategory): string => {
    switch (category) {
      case 'nodejs': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'electron': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'puppeteer': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'Browse4Extract': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    }
  };

  // Get icon for log level
  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] bg-clip-text text-transparent">
              Advanced Debug Logs
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {filteredLogs.length} logs • Real-time monitoring
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportLogs}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 rounded-lg transition-colors flex items-center space-x-2 text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>

            <button
              onClick={onClearLogs}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors flex items-center space-x-2 text-sm text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-[#0a0a0a] border-b border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Category Filters */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400 mr-2">Filters:</span>
            {(Object.keys(filters) as LogCategory[]).map(category => (
              <button
                key={category}
                onClick={() => toggleFilter(category)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  filters[category]
                    ? getCategoryColor(category)
                    : 'text-gray-500 bg-gray-800/30 border-gray-700/30'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Auto-scroll Toggle */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#6fbb69] focus:ring-[#6fbb69]"
            />
            <span className="text-sm text-gray-300">Auto-scroll</span>
          </label>
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all text-gray-100 placeholder-gray-500 text-sm"
          />
        </div>
      </div>

      {/* Logs Display */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Info className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-500">
                {searchTerm ? 'No logs match your search' : 'No logs yet. Start debugging!'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {filteredLogs.map((log, index) => {
              const time = new Date(log.timestamp).toLocaleTimeString();

              return (
                <div
                  key={index}
                  className="flex items-start space-x-3 text-xs p-2 rounded-lg bg-[#0a0a0a]/50 hover:bg-[#1a1a1a]/50 transition-colors font-mono"
                >
                  {/* Time */}
                  <span className="text-gray-500 flex-shrink-0 w-20">
                    {time}
                  </span>

                  {/* Category Badge */}
                  <span className={`px-2 py-0.5 rounded border text-xs font-medium flex-shrink-0 ${getCategoryColor(log.category)}`}>
                    {log.category}
                  </span>

                  {/* Level Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.level)}
                  </div>

                  {/* Message */}
                  <span className="flex-1 text-gray-200 break-all">
                    {log.message}
                    {log.sanitized && (
                      <span className="ml-2 text-yellow-400 text-xs">
                        [SANITIZED]
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </>
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-[#0a0a0a] border-t border-gray-800 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>Total: {logs.length}</span>
            <span>Filtered: {filteredLogs.length}</span>
          </div>
          <div className="flex items-center space-x-4">
            {(Object.keys(filters) as LogCategory[]).map(cat => {
              const count = logs.filter(l => l.category === cat).length;
              return (
                <span key={cat} className={getCategoryColor(cat).split(' ')[0]}>
                  {cat}: {count}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedLogsViewer;
