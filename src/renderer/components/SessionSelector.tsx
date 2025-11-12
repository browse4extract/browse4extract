import React, { useState, useEffect } from 'react';
import { Menu } from '@headlessui/react';
import { ChevronDown, Key, CheckCircle, Plus, Settings } from 'lucide-react';
import { SessionProfile } from '../../types/types';

interface SessionSelectorProps {
  selectedSessionId?: string;
  onSessionSelect: (sessionId: string | undefined) => void;
  onManageSessions?: () => void;
  refreshTrigger?: number;
  className?: string;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  selectedSessionId,
  onSessionSelect,
  onManageSessions,
  refreshTrigger,
  className = ''
}) => {
  const [sessions, setSessions] = useState<SessionProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [refreshTrigger]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const sessionList = await window.electronAPI.listSessions();
      setSessions(sessionList);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <Menu as="div" className={`relative ${className}`}>
      <Menu.Button className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-left text-gray-300 hover:bg-[#1a1a1a] hover:border-gray-700 transition-colors flex items-center justify-between group">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Key className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {isLoading ? (
            <span className="text-gray-500 text-sm">Loading sessions...</span>
          ) : selectedSession ? (
            <div className="min-w-0 flex-1">
              <span className="text-white font-medium truncate block">{selectedSession.name}</span>
              <span className="text-xs text-gray-500 truncate block">{selectedSession.domain}</span>
            </div>
          ) : (
            <span className="text-gray-500 text-sm">No session (scrape without login)</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-400 flex-shrink-0" />
      </Menu.Button>

      <Menu.Items className="absolute z-10 mt-2 w-full bg-[#0a0a0a] border border-gray-800 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto">
        {/* No session option */}
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={() => onSessionSelect(undefined)}
              className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
                active ? 'bg-[#1a1a1a]' : ''
              } ${!selectedSessionId ? 'bg-[#1a1a1a]/50' : ''}`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                {!selectedSessionId && <CheckCircle className="w-4 h-4 text-green-400" />}
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-300">No Session</div>
                <div className="text-xs text-gray-500">Scrape without authentication</div>
              </div>
            </button>
          )}
        </Menu.Item>

        {sessions.length > 0 && (
          <>
            <div className="h-px bg-gray-800 my-1" />

            {sessions.map((session) => (
              <Menu.Item key={session.id}>
                {({ active }) => (
                  <button
                    onClick={() => onSessionSelect(session.id)}
                    className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
                      active ? 'bg-[#1a1a1a]' : ''
                    } ${selectedSessionId === session.id ? 'bg-[#1a1a1a]/50' : ''}`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      {selectedSessionId === session.id && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{session.name}</div>
                      <div className="text-xs text-gray-500 truncate">{session.domain}</div>
                      {session.lastUsed && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          Last used: {new Date(session.lastUsed).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </Menu.Item>
            ))}

            {/* Manage sessions link */}
            {onManageSessions && (
              <>
                <div className="h-px bg-gray-800 my-1" />
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onManageSessions}
                      className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
                        active ? 'bg-[#1a1a1a]' : ''
                      }`}
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <div className="text-sm text-gray-400">Manage sessions</div>
                    </button>
                  )}
                </Menu.Item>
              </>
            )}
          </>
        )}

        {!isLoading && sessions.length === 0 && onManageSessions && (
          <>
            <div className="h-px bg-gray-800 my-1" />
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onManageSessions}
                  className={`w-full px-3 py-2.5 text-left transition-colors flex items-center gap-2 ${
                    active ? 'bg-[#1a1a1a]' : ''
                  }`}
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <div className="text-sm text-blue-400 font-medium">Create your first session</div>
                    <div className="text-xs text-gray-500">Save login to scrape protected content</div>
                  </div>
                </button>
              )}
            </Menu.Item>
          </>
        )}
      </Menu.Items>
    </Menu>
  );
};

export default SessionSelector;
