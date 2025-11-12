import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, ExternalLink, Save, AlertCircle, AlertTriangle } from 'lucide-react';

interface SessionCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string) => void;
}

const SessionCreator: React.FC<SessionCreatorProps> = ({ isOpen, onClose, onSessionCreated }) => {
  const [sessionName, setSessionName] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [browserOpened, setBrowserOpened] = useState(false);
  const [error, setError] = useState('');
  const [tempSessionId, setTempSessionId] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleOpenBrowser = async () => {
    if (!sessionName.trim() || !loginUrl.trim()) {
      setError('Please provide both session name and login URL');
      return;
    }

    // Sanitize and validate session name
    const sanitizedName = sessionName.trim().replace(/[\/\\:*?"<>|]/g, '_');
    if (sanitizedName.length < 3) {
      setError('Session name must be at least 3 characters');
      return;
    }
    if (sanitizedName.length > 100) {
      setError('Session name too long (max 100 characters)');
      return;
    }

    // Validate URL
    try {
      const url = new URL(loginUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        setError('URL must start with http:// or https://');
        return;
      }
    } catch (e) {
      setError('Invalid URL format');
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      const result = await window.electronAPI.createSession(sanitizedName, loginUrl);

      if (result.success && result.profile) {
        setTempSessionId(result.profile.id);
        setBrowserOpened(true);
        setIsCreating(false);
      } else {
        setError(result.error || 'Failed to create session');
        setIsCreating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsCreating(false);
    }
  };

  const handleSaveSession = async () => {
    if (!tempSessionId) {
      setError('No active session to save');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const domain = new URL(loginUrl).hostname;
      const result = await window.electronAPI.saveCurrentSession(
        tempSessionId,
        sessionName,
        domain,
        loginUrl
      );

      if (result.success && result.profile) {
        // Reset state
        setSessionName('');
        setLoginUrl('');
        setBrowserOpened(false);
        setTempSessionId('');
        setIsSaving(false);

        // Notify parent with the session ID and close
        onSessionCreated(result.profile.id);
        onClose();
      } else {
        setError(result.error || 'Failed to save session');
        setIsSaving(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (browserOpened) {
      // Show confirmation modal
      setShowCancelConfirm(true);
      return;
    }

    // Reset state and close
    resetAndClose();
  };

  const resetAndClose = () => {
    setSessionName('');
    setLoginUrl('');
    setBrowserOpened(false);
    setTempSessionId('');
    setError('');
    setIsCreating(false);
    setIsSaving(false);
    setShowCancelConfirm(false);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-blue-400" />
                    New Session
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
                    disabled={isCreating || isSaving}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {!browserOpened ? (
                    <>
                      {/* Step 1: Enter session details */}
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          Session Name
                        </label>
                        <input
                          type="text"
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder="e.g., GitHub Account, Reddit Login"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={isCreating}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          Login URL
                        </label>
                        <input
                          type="url"
                          value={loginUrl}
                          onChange={(e) => setLoginUrl(e.target.value)}
                          placeholder="https://example.com/login"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={isCreating}
                        />
                        <p className="mt-1 text-xs text-zinc-500">
                          The URL where you'll log in. After opening, complete all authentication steps (login, 2FA, etc.) before saving.
                        </p>
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                          <p className="text-sm text-red-300">{error}</p>
                        </div>
                      )}

                      <button
                        onClick={handleOpenBrowser}
                        disabled={isCreating || !sessionName.trim() || !loginUrl.trim()}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isCreating ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Opening Browser...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-5 h-5" />
                            Open Browser for Login
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Step 2: Browser opened, waiting for user to log in */}
                      {/* Waiting indicator with pulse animation */}
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-5 h-5 bg-yellow-500 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex-1">
                          <p className="text-yellow-300 text-sm font-medium mb-1">
                            ⏳ Waiting for you to complete login...
                          </p>
                          <p className="text-yellow-200/70 text-xs">
                            Complete all authentication steps (including 2FA if required) in the browser window
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-blue-300 text-sm mb-3 font-medium">
                          Instructions:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-200">
                          <li>Log in to your account in the browser</li>
                          <li>Complete any 2FA/verification steps if required</li>
                          <li>Verify you're fully logged in and can access protected content</li>
                          <li>Return here and click "Save Session" below</li>
                        </ol>
                        <p className="mt-3 text-xs text-blue-300/70">
                          💡 Only click "Save Session" after you're completely logged in
                        </p>
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                          <p className="text-sm text-red-300">{error}</p>
                        </div>
                      )}

                      <button
                        onClick={handleSaveSession}
                        disabled={isSaving}
                        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Saving Session...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Save Session
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-300 font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      {/* Cancel Confirmation Modal */}
      <Transition appear show={showCancelConfirm} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[60]"
          onClose={() => setShowCancelConfirm(false)}
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
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-white mb-2">
                        Cancel Session Creation
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-gray-400">
                        The browser is still open for login. Are you sure you want to cancel? Your login progress will be lost.
                      </Dialog.Description>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-300 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 rounded-lg transition-colors"
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      Continue Login
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                      onClick={resetAndClose}
                    >
                      Cancel Anyway
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </Transition>
  );
};

export default SessionCreator;
