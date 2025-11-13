import React, { useState, useEffect, Fragment } from 'react';
import { Trash2, TestTube, RefreshCw, Key, Calendar, Globe, CheckCircle, XCircle, Plus, AlertTriangle } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { SessionProfile } from '../../types/types';
import SessionCreator from './SessionCreator';
import { useToast } from './ToastNotification';

interface SessionManagerProps {
  onSessionCreated?: (sessionId: string) => void;
  onSessionDeleted?: () => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({ onSessionCreated, onSessionDeleted }) => {
  const [sessions, setSessions] = useState<SessionProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingSessionId, setTestingSessionId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showCreator, setShowCreator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; name: string } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadSessions();
  }, []);

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

  const handleTestSession = async (sessionId: string) => {
    setTestingSessionId(sessionId);
    try {
      const result = await window.electronAPI.testSession(sessionId);
      setTestResults(prev => ({
        ...prev,
        [sessionId]: {
          success: result.success,
          message: result.success ? 'Session is valid' : (result.error || 'Session test failed')
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [sessionId]: {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setTestingSessionId(null);
    }
  };

  const handleDeleteSession = (sessionId: string, sessionName: string) => {
    setSessionToDelete({ id: sessionId, name: sessionName });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      const result = await window.electronAPI.deleteSession(sessionToDelete.id);
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
        setTestResults(prev => {
          const newResults = { ...prev };
          delete newResults[sessionToDelete.id];
          return newResults;
        });
        showToast(`Session "${sessionToDelete.name}" deleted successfully`, 'success');
        // Notify parent component to refresh SessionSelector
        if (onSessionDeleted) {
          onSessionDeleted();
        }
      } else {
        showToast(`Failed to delete session: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setShowDeleteConfirm(false);
      setSessionToDelete(null);
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    loadSessions();
    // Notify parent component
    if (onSessionCreated) {
      onSessionCreated(sessionId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Session Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSessions}
            disabled={isLoading}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreator(true)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-400">
        Manage your saved login sessions. Sessions store cookies and authentication data to scrape protected content.
      </p>

      {/* Sessions List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-zinc-800/50 rounded-lg border border-zinc-700 border-dashed">
            <Key className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 mb-2">No sessions saved yet</p>
            <p className="text-sm text-zinc-500 mb-4">
              Create a session to save your login and scrape protected content
            </p>
            <button
              onClick={() => setShowCreator(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Session
            </button>
          </div>
        ) : (
          sessions.map((session) => {
            const testResult = testResults[session.id];

            return (
              <div
                key={session.id}
                className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-semibold truncate">{session.name}</h3>
                      {testResult && (
                        testResult.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{session.domain}</span>
                      </div>

                      <div className="flex items-center gap-2 text-zinc-400">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Created: {new Date(session.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {session.lastUsed && (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>
                            Last used: {new Date(session.lastUsed).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {session.cookies && (
                        <div className="text-zinc-500 text-xs">
                          {session.cookies.length} cookie(s) stored
                        </div>
                      )}
                    </div>

                    {/* Test Result Message */}
                    {testResult && (
                      <div className={`mt-2 text-xs px-2 py-1 rounded inline-block ${
                        testResult.success
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleTestSession(session.id)}
                      disabled={testingSessionId === session.id}
                      className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap"
                      title="Test if session is still valid"
                    >
                      <TestTube className={`w-4 h-4 ${testingSessionId === session.id ? 'animate-pulse' : ''}`} />
                      {testingSessionId === session.id ? 'Testing...' : 'Test'}
                    </button>

                    <button
                      onClick={() => handleDeleteSession(session.id, session.name)}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                      title="Delete this session"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Session Creator Modal */}
      <SessionCreator
        isOpen={showCreator}
        onClose={() => setShowCreator(false)}
        onSessionCreated={handleSessionCreated}
      />

      {/* Delete Confirmation Modal */}
      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setShowDeleteConfirm(false);
            setSessionToDelete(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-[#0a0a0a] border border-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-white mb-2">
                        Delete Session
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-gray-400">
                        Are you sure you want to delete the session "{sessionToDelete?.name}"? This action cannot be undone.
                      </Dialog.Description>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-300 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 rounded-lg transition-colors"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setSessionToDelete(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      onClick={confirmDeleteSession}
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default SessionManager;
