import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import type { UpdateLauncherData } from '../types/update';
import appLogo from './assets/app_image.png';

/**
 * Update launcher interface
 * Displays update check, download and installation status
 */
function UpdateLauncher() {
  const [launcherData, setLauncherData] = useState<UpdateLauncherData>({
    state: 'checking',
    currentVersion: '0.0.0',
  });

  useEffect(() => {
    // Listen for state updates from main process
    const cleanup = window.electronAPI.onUpdateLauncherState((data: UpdateLauncherData) => {
      setLauncherData(data);
    });

    return cleanup;
  }, []);

  const handleRetry = () => {
    window.electronAPI.retryUpdateCheck();
  };

  const handleLaunchAnyway = () => {
    window.electronAPI.launchAppAnyway();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full flex flex-col items-center justify-center p-8">
        {/* Logo */}
        <div className="mb-8">
          <img
            src={appLogo}
            alt="Browse4Extract"
            className="w-20 h-20 rounded-2xl shadow-2xl"
          />
        </div>

        {/* Contenu principal */}
        <div className="w-full max-w-md bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 p-8">
          {/* State: Checking */}
          {launcherData.state === 'checking' && (
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Checking for updates
              </h2>
              <p className="text-gray-400 text-sm">
                Current version: {launcherData.currentVersion}
              </p>
            </div>
          )}

          {/* State: Update available */}
          {launcherData.state === 'update-available' && (
            <div className="text-center">
              <Download className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Update available
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                {launcherData.currentVersion} → {launcherData.remoteVersion}
              </p>

              {/* Changelog */}
              {launcherData.changelog &&
                launcherData.changelog.length > 0 && (
                  <div className="mt-6 mb-4 bg-gray-900/50 rounded-lg p-4 max-h-40 overflow-y-auto text-left">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">
                      What's new:
                    </h3>
                    <ul className="space-y-1">
                      {launcherData.changelog.map((item, index) => (
                        <li
                          key={index}
                          className="text-xs text-gray-400 flex items-start"
                        >
                          <span className="mr-2">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              <p className="text-xs text-gray-500">
                Download will start automatically...
              </p>
            </div>
          )}

          {/* State: Downloading */}
          {launcherData.state === 'downloading' && (
            <div className="text-center">
              <Download className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Downloading
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Version {launcherData.remoteVersion}
              </p>

              {/* Progress bar */}
              {launcherData.progress && (
                <div className="space-y-3">
                  <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${launcherData.progress.percent}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-gray-400">
                    <span>
                      {formatBytes(launcherData.progress.transferred)} /{' '}
                      {formatBytes(launcherData.progress.total)}
                    </span>
                    <span>
                      {launcherData.progress.percent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    {formatSpeed(launcherData.progress.speed)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* State: Installing */}
          {launcherData.state === 'installing' && (
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Installing
              </h2>
              <p className="text-gray-400 text-sm">
                Installing version {launcherData.remoteVersion}
              </p>
              <p className="text-xs text-gray-500 mt-4">
                Application will restart automatically...
              </p>
            </div>
          )}

          {/* State: Error */}
          {launcherData.state === 'error' && (
            <div className="text-center">
              {launcherData.error?.type === 'NO_INTERNET' ? (
                <WifiOff className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              ) : (
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              )}

              <h2 className="text-xl font-semibold text-white mb-2">
                {launcherData.error?.type === 'NO_INTERNET'
                  ? 'No internet connection'
                  : 'Error'}
              </h2>

              <p className="text-gray-400 text-sm mb-6">
                {launcherData.error?.message}
              </p>

              {launcherData.error?.type === 'NO_INTERNET' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
                  <p className="text-xs text-orange-300">
                    Without updates, some bugs may not be fixed and features may be missing.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={handleLaunchAnyway}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  Launch anyway
                </button>
              </div>
            </div>
          )}

          {/* State: Ready */}
          {launcherData.state === 'ready' && (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Everything is up to date!
              </h2>
              <p className="text-gray-400 text-sm">
                Launching Browse4Extract...
              </p>
            </div>
          )}
        </div>

        {/* Version at bottom */}
        <div className="mt-8 text-xs text-gray-600">
          Browse4Extract v{launcherData.currentVersion}
        </div>
      </div>
    </div>
  );
}

export default UpdateLauncher;
