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
import { getAppVersion } from './utils/buildInfo';

/**
 * Update launcher interface
 * Displays update check, download and installation status
 */
function UpdateLauncher() {
  const [launcherData, setLauncherData] = useState<UpdateLauncherData>({
    state: 'checking',
    currentVersion: getAppVersion(), // Use buildInfo as fallback instead of '0.0.0'
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
    <div className="h-screen w-screen bg-[#000000] flex items-center justify-center overflow-hidden">
      <div className="w-full h-full flex flex-col items-center justify-center p-8">
        {/* Logo */}
        <div className="mb-8">
          <img
            src={appLogo}
            alt="Browse4Extract"
            className="w-24 h-24 rounded-2xl shadow-2xl ring-2 ring-gray-800/50"
          />
        </div>

        {/* Main content container */}
        <div className="w-full max-w-2xl bg-[#0a0a0a]/80 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-800/50 p-8">
          {/* State: Checking */}
          {launcherData.state === 'checking' && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <Loader2 className="w-14 h-14 text-[#6fbb69] animate-spin" />
                  <div className="absolute inset-0 blur-xl bg-[#6fbb69]/30 rounded-full"></div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-3">
                Checking for updates
              </h2>
              <p className="text-gray-400 text-sm">
                Current version: <span className="text-gray-300 font-medium">{launcherData.currentVersion}</span>
              </p>
            </div>
          )}

          {/* State: Update available */}
          {launcherData.state === 'update-available' && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <Download className="w-14 h-14 text-[#6fbb69]" />
                  <div className="absolute inset-0 blur-xl bg-[#6fbb69]/30 rounded-full"></div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-3">
                Update available
              </h2>
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="text-gray-400 font-medium">{launcherData.currentVersion}</span>
                <div className="w-8 h-0.5 bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7]"></div>
                <span className="text-[#6fbb69] font-semibold">{launcherData.remoteVersion}</span>
              </div>

              {/* Changelog */}
              {launcherData.changelog &&
                launcherData.changelog.length > 0 && (
                  <div className="mt-6 mb-6 bg-[#1a1a1a]/50 rounded-lg p-5 max-h-48 overflow-y-auto text-left border border-gray-800/30">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-5 bg-gradient-to-b from-[#6fbb69] to-[#bf8fd7] rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-200">
                        What's new
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {launcherData.changelog.map((item, index) => (
                        <li
                          key={index}
                          className="text-sm text-gray-300 flex items-start"
                        >
                          <span className="mr-2 text-[#6fbb69]">•</span>
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
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <Download className="w-14 h-14 text-[#bf8fd7] animate-pulse" />
                  <div className="absolute inset-0 blur-xl bg-[#bf8fd7]/30 rounded-full"></div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-3">
                Downloading
              </h2>
              <p className="text-gray-400 text-sm mb-8">
                Version <span className="text-gray-300 font-medium">{launcherData.remoteVersion}</span>
              </p>

              {/* Progress bar */}
              {launcherData.progress && (
                <div className="space-y-4">
                  <div className="w-full bg-[#1a1a1a] rounded-full h-3 overflow-hidden border border-gray-800/50">
                    <div
                      className="bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] h-3 rounded-full transition-all duration-300 ease-out relative"
                      style={{
                        width: `${launcherData.progress.percent}%`,
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm text-gray-400">
                    <span>
                      {formatBytes(launcherData.progress.transferred)} /{' '}
                      {formatBytes(launcherData.progress.total)}
                    </span>
                    <span className="text-gray-300 font-medium">
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
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <Loader2 className="w-14 h-14 text-[#bf8fd7] animate-spin" />
                  <div className="absolute inset-0 blur-xl bg-[#bf8fd7]/30 rounded-full"></div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-3">
                Installing
              </h2>
              <p className="text-gray-400 text-sm">
                Installing version <span className="text-gray-300 font-medium">{launcherData.remoteVersion}</span>
              </p>
              <p className="text-xs text-gray-500 mt-6 bg-[#1a1a1a]/50 rounded-lg py-3 px-4 border border-gray-800/30">
                Application will restart automatically...
              </p>
            </div>
          )}

          {/* State: Error */}
          {launcherData.state === 'error' && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  {launcherData.error?.type === 'NO_INTERNET' ? (
                    <WifiOff className="w-14 h-14 text-orange-500" />
                  ) : (
                    <AlertCircle className="w-14 h-14 text-red-500" />
                  )}
                  <div className={`absolute inset-0 blur-xl rounded-full ${
                    launcherData.error?.type === 'NO_INTERNET' ? 'bg-orange-500/30' : 'bg-red-500/30'
                  }`}></div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-100 mb-3">
                {launcherData.error?.type === 'NO_INTERNET'
                  ? 'No internet connection'
                  : 'Error'}
              </h2>

              <p className="text-gray-400 text-sm mb-6">
                {launcherData.error?.message}
              </p>

              {launcherData.error?.type === 'NO_INTERNET' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-orange-300">
                    Without updates, some bugs may not be fixed and features may be missing.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] hover:opacity-90 text-white px-5 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={handleLaunchAnyway}
                  className="flex-1 bg-[#1a1a1a]/80 hover:bg-[#1a1a1a] border border-gray-700 text-gray-300 px-5 py-3 rounded-lg font-medium transition-all"
                >
                  Launch anyway
                </button>
              </div>
            </div>
          )}

          {/* State: Ready */}
          {launcherData.state === 'ready' && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <CheckCircle className="w-14 h-14 text-[#6fbb69]" />
                  <div className="absolute inset-0 blur-xl bg-[#6fbb69]/30 rounded-full"></div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-3">
                Everything is up to date!
              </h2>
              <p className="text-gray-400 text-sm">
                Launching Browse4Extract...
              </p>
            </div>
          )}
        </div>

        {/* Version at bottom */}
        <div className="mt-8 text-sm text-gray-600">
          Browse4Extract <span className="text-gray-500">v{launcherData.currentVersion}</span>
        </div>
      </div>
    </div>
  );
}

export default UpdateLauncher;
