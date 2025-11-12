import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  FolderOpen,
  Save,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  MousePointer,
  FileJson,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Settings,
  Folder,
  ExternalLink,
  Key
} from 'lucide-react';
import { DataExtractor, ExtractorType, LogMessage, ScrapedData, ExportFormat } from '../types/types';
import CustomTitleBar from './components/CustomTitleBar';
import ConfirmationModal from './components/ConfirmationModal';
import { useToast } from './components/ToastNotification';
import SessionManager from './components/SessionManager';
import SessionSelector from './components/SessionSelector';
import CreditsModal from './components/CreditsModal';

interface ProfileData {
  url: string;
  fileName: string;
  debugMode: boolean;
  exportFormat: ExportFormat;
  extractors: DataExtractor[];
  sessionProfileId?: string;
}

function App() {
  // Toast notifications
  const { showToast } = useToast();

  // Configuration
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [extractors, setExtractors] = useState<DataExtractor[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [sessionRefreshTrigger, setSessionRefreshTrigger] = useState(0);

  // Validation state for extractors
  const [validationErrors, setValidationErrors] = useState<Record<string, { fieldName?: boolean; selector?: boolean; attributeName?: boolean }>>({});

  // Initial state for change detection
  const [initialState, setInitialState] = useState<ProfileData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Preview
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewingExtractorId, setPreviewingExtractorId] = useState<string | null>(null);

  // Visual Picker
  const [isPickingElement, setIsPickingElement] = useState(false);
  const [pickingExtractorId, setPickingExtractorId] = useState<string | null>(null);

  // Scraping state
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [extractedData, setExtractedData] = useState<ScrapedData[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

  // Outputs path - kept for settings functionality
  const [outputsPath, setOutputsPath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('Ready to extract data');

  // Suppress unused warning - outputsPath is used in settings
  void outputsPath;

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [tempOutputsPath, setTempOutputsPath] = useState('');
  const [tempSavesPath, setTempSavesPath] = useState('');
  const [tempDiscordRpc, setTempDiscordRpc] = useState(false);
  const [tempDebugEnabled, setTempDebugEnabled] = useState(false);
  const [tempShowBrowser, setTempShowBrowser] = useState(false);
  const [tempAdvancedLogs, setTempAdvancedLogs] = useState(false);
  const [tempSecurityLevel, setTempSecurityLevel] = useState<'relaxed' | 'normal' | 'strict' | 'paranoid'>('normal');
  const [tempAutoScroll, setTempAutoScroll] = useState(true);
  const [tempHandleCookies, setTempHandleCookies] = useState(true);

  // Credits modal
  const [showCredits, setShowCredits] = useState(false);

  // Visual picker result modal
  const [showPickerResult, setShowPickerResult] = useState(false);
  const [pickerResult, setPickerResult] = useState<any>(null);

  // Close confirmation modal
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  // Auto-scroll refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const dataEndRef = useRef<HTMLDivElement>(null);

  // Setup IPC listeners ONCE on mount
  useEffect(() => {
    // Load config
    loadConfig();

    // Check if app was opened with a .b4e file
    checkStartupProfile();

    // Setup event listeners and store cleanup functions
    const cleanupLog = window.electronAPI.onLog((log: LogMessage) => {
      setLogs(prev => [...prev, log]);
    });

    const cleanupDataExtracted = window.electronAPI.onDataExtracted((data: ScrapedData) => {
      setExtractedData(prev => [...prev, data]);
    });

    const cleanupComplete = window.electronAPI.onScrapingComplete((result: any) => {
      setIsRunning(false);
      setStatus('completed');
      setStatusMessage(`✓ Extraction completed! ${result.itemCount} items saved to ${result.fileName}`);
    });

    const cleanupError = window.electronAPI.onScrapingError((error: any) => {
      setIsRunning(false);
      setStatus('error');
      setStatusMessage(`✗ Error: ${error.error}`);
    });

    const cleanupProfileLoaded = window.electronAPI.onProfileLoaded((result: any) => {
      if (result.success && result.data) {
        loadProfileData(result.data);
        setStatusMessage(`Profile loaded from ${result.path}`);
      }
    });

    const cleanupSaveBeforeClose = window.electronAPI.onSaveBeforeClose(async () => {
      // User chose to save before closing from main process dialog
      try {
        const profileData = getCurrentState();
        const result = await window.electronAPI.saveProfile(profileData);

        if (result.success) {
          // Save succeeded, notify main process to proceed with close
          await window.electronAPI.saveCompletedClose();
        }
        // If user canceled save dialog, window will stay open (main process handles this)
      } catch (error) {
        console.error('Error during save before close:', error);
        // On error, don't close the window
      }
    });

    const cleanupShowCloseConfirmation = window.electronAPI.onShowCloseConfirmation(() => {
      // Show custom confirmation modal instead of system dialog
      setShowCloseConfirmation(true);
    });

    // Cleanup function to remove all listeners when component unmounts
    return () => {
      cleanupLog();
      cleanupDataExtracted();
      cleanupComplete();
      cleanupError();
      cleanupProfileLoaded();
      cleanupSaveBeforeClose();
      cleanupShowCloseConfirmation();
    };
  }, []); // Empty array = run once on mount

  // Handle before unload (ask to save if changes)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Sync unsaved changes state to main process (for window close handling)
  useEffect(() => {
    window.electronAPI.setUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  // Auto-scroll logs and data
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    dataEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [extractedData]);

  // Detect changes
  useEffect(() => {
    if (!initialState) return;

    const currentState: ProfileData = {
      url,
      fileName,
      debugMode,
      exportFormat,
      extractors
    };

    const hasChanges = JSON.stringify(currentState) !== JSON.stringify(initialState);
    setHasUnsavedChanges(hasChanges);
  }, [url, fileName, debugMode, exportFormat, extractors, selectedSessionId, initialState]);

  const getCurrentState = (): ProfileData => ({
    url,
    fileName,
    debugMode,
    exportFormat,
    extractors,
    sessionProfileId: selectedSessionId
  });

  const saveCurrentStateAsInitial = () => {
    setInitialState(getCurrentState());
    setHasUnsavedChanges(false);
  };

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setOutputsPath(config.outputsPath);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const checkStartupProfile = async () => {
    try {
      const result = await window.electronAPI.getStartupProfile();
      if (result.success && result.data) {
        loadProfileData(result.data);
        setStatusMessage(`Profile loaded: ${result.path}`);
      } else {
        // No profile loaded, set current state as initial
        saveCurrentStateAsInitial();
      }
    } catch (error) {
      console.error('Error checking startup profile:', error);
      saveCurrentStateAsInitial();
    }
  };

  const handleOpenSettings = async () => {
    // Load current config into temp state
    try {
      const config = await window.electronAPI.getConfig();
      const debugSettings = await window.electronAPI.getDebugSettings();

      setTempOutputsPath(config.outputsPath);
      setTempSavesPath(config.savesPath);
      setTempDiscordRpc(config.enableDiscordRPC || false);

      // Load debug settings
      setTempDebugEnabled(debugSettings.enabled);
      setTempShowBrowser(debugSettings.showBrowser);
      setTempAdvancedLogs(debugSettings.advancedLogs);
      setTempSecurityLevel(debugSettings.securityLevel || 'normal');
      setTempAutoScroll(debugSettings.autoScroll !== undefined ? debugSettings.autoScroll : true);
      setTempHandleCookies(debugSettings.handleCookies !== undefined ? debugSettings.handleCookies : true);

      setShowSettings(true);
    } catch (error) {
      console.error('Error loading config for settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Get current settings to compare changes
      const config = await window.electronAPI.getConfig();
      const debugSettings = await window.electronAPI.getDebugSettings();

      // Log Discord RPC changes
      if (config.enableDiscordRPC !== tempDiscordRpc) {
        console.log(`User ${tempDiscordRpc ? 'enabled' : 'disabled'} Discord Rich Presence`);
      }

      // Log path changes
      if (config.outputsPath !== tempOutputsPath) {
        console.log(`User updated outputs path to: ${tempOutputsPath}`);
      }
      if (config.savesPath !== tempSavesPath) {
        console.log(`User updated saves path to: ${tempSavesPath}`);
      }

      // Log debug mode changes
      if (debugSettings.enabled !== tempDebugEnabled) {
        console.log(`User ${tempDebugEnabled ? 'enabled' : 'disabled'} Debug Mode`);
      }
      if (debugSettings.showBrowser !== tempShowBrowser) {
        console.log(`User ${tempShowBrowser ? 'enabled' : 'disabled'} Show Browser mode`);
      }
      if (debugSettings.advancedLogs !== tempAdvancedLogs) {
        console.log(`User ${tempAdvancedLogs ? 'enabled' : 'disabled'} Advanced Logs window`);
      }
      if (debugSettings.securityLevel !== tempSecurityLevel) {
        console.log(`User changed security level from ${debugSettings.securityLevel} to ${tempSecurityLevel}`);
      }
      if (debugSettings.autoScroll !== tempAutoScroll) {
        console.log(`User ${tempAutoScroll ? 'enabled' : 'disabled'} Auto-scroll pages`);
      }
      if (debugSettings.handleCookies !== tempHandleCookies) {
        console.log(`User ${tempHandleCookies ? 'enabled' : 'disabled'} Cookie banner handling`);
      }

      await window.electronAPI.updateConfig({
        outputsPath: tempOutputsPath,
        savesPath: tempSavesPath,
        enableDiscordRPC: tempDiscordRpc
      });

      // Save debug settings
      await window.electronAPI.updateDebugSettings({
        enabled: tempDebugEnabled,
        showBrowser: tempShowBrowser,
        advancedLogs: tempAdvancedLogs,
        securityLevel: tempSecurityLevel,
        autoScroll: tempAutoScroll,
        handleCookies: tempHandleCookies
      });

      setOutputsPath(tempOutputsPath);
      setDebugMode(tempShowBrowser); // Keep old debugMode synced with showBrowser
      setShowSettings(false);
      setStatusMessage('Settings saved successfully');
      console.log('User saved settings successfully');
      showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast(`Failed to save settings: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleSelectOutputsFolder = async () => {
    try {
      const result = await window.electronAPI.selectFolder('Select Outputs Folder', tempOutputsPath);
      if (result.success && result.path) {
        setTempOutputsPath(result.path);
      }
    } catch (error) {
      console.error('Error selecting outputs folder:', error);
    }
  };

  const handleSelectSavesFolder = async () => {
    try {
      const result = await window.electronAPI.selectFolder('Select Saves Folder', tempSavesPath);
      if (result.success && result.path) {
        setTempSavesPath(result.path);
      }
    } catch (error) {
      console.error('Error selecting saves folder:', error);
    }
  };

  const handleOpenSavesFolder = async () => {
    try {
      await window.electronAPI.openSavesFolder();
    } catch (error) {
      showToast(`Failed to open saves folder: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const addExtractor = () => {
    const newExtractor: DataExtractor = {
      id: Date.now().toString(),
      fieldName: '',
      selector: '',
      extractorType: 'text',
      attributeName: ''
    };
    setExtractors([...extractors, newExtractor]);
  };

  const removeExtractor = (id: string) => {
    setExtractors(extractors.filter(e => e.id !== id));
    if (previewingExtractorId === id) {
      setPreviewResult(null);
      setPreviewingExtractorId(null);
    }
  };

  const updateExtractor = (id: string, field: keyof DataExtractor, value: any) => {
    setExtractors(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
    // Clear preview if extractor is modified
    if (previewingExtractorId === id) {
      setPreviewResult(null);
      setPreviewingExtractorId(null);
    }
  };

  // Update multiple fields at once (for visual picker)
  const updateExtractorMultiple = (id: string, updates: Partial<DataExtractor>) => {
    setExtractors(prev => prev.map(e =>
      e.id === id ? { ...e, ...updates } : e
    ));
    // Clear preview if extractor is modified
    if (previewingExtractorId === id) {
      setPreviewResult(null);
      setPreviewingExtractorId(null);
    }
  };

  // Validate single extractor and update validation errors
  const validateExtractor = (extractor: DataExtractor): boolean => {
    const errors: { fieldName?: boolean; selector?: boolean; attributeName?: boolean } = {};
    let isValid = true;

    if (!extractor.fieldName.trim()) {
      errors.fieldName = true;
      isValid = false;
    }

    if (!extractor.selector.trim()) {
      errors.selector = true;
      isValid = false;
    }

    if (extractor.extractorType === 'attribute' && !extractor.attributeName?.trim()) {
      errors.attributeName = true;
      isValid = false;
    }

    setValidationErrors(prev => ({
      ...prev,
      [extractor.id]: errors
    }));

    return isValid;
  };

  // Clear validation errors for an extractor
  const clearValidationError = (extractorId: string, field?: 'fieldName' | 'selector' | 'attributeName') => {
    setValidationErrors(prev => {
      const extractorErrors = { ...prev[extractorId] };
      if (field) {
        delete extractorErrors[field];
      } else {
        return { ...prev, [extractorId]: {} };
      }
      return { ...prev, [extractorId]: extractorErrors };
    });
  };

  const handlePreviewSelector = async (extractor: DataExtractor) => {
    if (!url.trim()) {
      showToast('Please enter a URL first', 'warning');
      return;
    }

    if (!extractor.selector.trim()) {
      showToast('Please enter a selector', 'warning');
      return;
    }

    try {
      setPreviewingExtractorId(extractor.id);
      setPreviewResult({ loading: true });

      const result = await window.electronAPI.previewSelector(
        url,
        extractor.selector,
        extractor.extractorType,
        extractor.attributeName
      );

      setPreviewResult(result);
    } catch (error) {
      setPreviewResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handlePickElement = async (extractor: DataExtractor) => {
    if (!url.trim()) {
      showToast('Please enter a URL first', 'warning');
      return;
    }

    try {
      setIsPickingElement(true);
      setPickingExtractorId(extractor.id);

      const result = await window.electronAPI.pickElement(url, selectedSessionId);

      if (result.success && result.element) {
        // Build updates object
        const updates: Partial<DataExtractor> = {
          selector: result.element.selector
        };

        // Auto-update extractor type based on suggestion
        if (result.element.suggestedExtractorType) {
          updates.extractorType = result.element.suggestedExtractorType as any;
        }

        // Auto-update attribute if suggested
        if (result.element.suggestedAttribute) {
          updates.attributeName = result.element.suggestedAttribute;
        }

        // Update all fields at once (avoids React batching issues)
        updateExtractorMultiple(extractor.id, updates);

        // Show modal with result
        setPickerResult({
          ...result.element,
          extractorId: extractor.id
        });
        setShowPickerResult(true);
      } else {
        setPickerResult({
          error: result.error || 'Unknown error',
          cancelled: true
        });
        setShowPickerResult(true);
      }
    } catch (error) {
      setPickerResult({
        error: error instanceof Error ? error.message : String(error),
        cancelled: false
      });
      setShowPickerResult(true);
    } finally {
      setIsPickingElement(false);
      setPickingExtractorId(null);
    }
  };

  const handleStartScraping = async () => {
    if (!url.trim()) {
      showToast('Please enter a URL before starting extraction', 'warning');
      return;
    }

    if (extractors.length === 0) {
      showToast('Please add at least one extractor before starting extraction', 'warning');
      return;
    }

    // Validate extractors and collect validation errors
    let hasErrors = false;
    const invalidExtractors: string[] = [];

    for (const extractor of extractors) {
      const isValid = validateExtractor(extractor);
      if (!isValid) {
        hasErrors = true;
        invalidExtractors.push(extractor.fieldName || 'Unnamed field');
      }
    }

    if (hasErrors) {
      showToast('Some extractors have missing required fields. Please check the highlighted fields below.', 'error');
      return;
    }

    // Reset state
    setLogs([]);
    setExtractedData([]);
    setStatus('running');
    setStatusMessage('⏳ Extraction in progress...');
    setIsRunning(true);

    // Generate filename with appropriate extension
    let finalFileName = fileName.trim();
    if (!finalFileName) {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      const timestamp = Date.now();
      finalFileName = `${domain}-${timestamp}`;
    }

    // Add extension based on format
    const extension = exportFormat === 'excel' ? '.xlsx' : exportFormat === 'csv' ? '.csv' : '.json';
    if (!finalFileName.endsWith(extension)) {
      // Remove old extension if present
      finalFileName = finalFileName.replace(/\.(json|csv|xlsx)$/, '');
      finalFileName += extension;
    }

    // Start scraping
    try {
      await window.electronAPI.startScraping({
        url,
        fileName: finalFileName,
        extractors,
        debugMode,
        exportFormat,
        sessionProfileId: selectedSessionId
      });
    } catch (error) {
      setIsRunning(false);
      setStatus('error');
      setStatusMessage(`Error: ${error}`);
    }
  };

  const handleReset = () => {
    if (hasUnsavedChanges) {
      setPendingAction(() => () => performReset());
      setShowCloseConfirmation(true);
    } else {
      performReset();
    }
  };

  const performReset = () => {
    setUrl('');
    setFileName('');
    setDebugMode(false);
    setExportFormat('json');
    setExtractors([]);
    setLogs([]);
    setExtractedData([]);
    setStatus('idle');
    setStatusMessage('Ready to extract data');
    setPreviewResult(null);
    setPreviewingExtractorId(null);
    saveCurrentStateAsInitial();
  };

  // Profile management functions
  const handleSaveProfile = async () => {
    try {
      const profileData = getCurrentState();
      const result = await window.electronAPI.saveProfile(profileData);

      if (result.success) {
        console.log(`User saved profile to: ${result.path}`);
        setStatusMessage(`✓ Profile saved: ${result.path}`);
        saveCurrentStateAsInitial();
        showToast('Profile saved successfully', 'success');
      } else if (!result.canceled) {
        console.error(`Failed to save profile: ${result.error || 'Unknown error'}`);
        showToast(`Failed to save profile: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast(`Failed to save profile: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleLoadProfile = async () => {
    if (hasUnsavedChanges) {
      setPendingAction(() => async () => {
        await performLoadProfile();
      });
      setShowCloseConfirmation(true);
    } else {
      await performLoadProfile();
    }
  };

  const performLoadProfile = async () => {
    try {
      const result = await window.electronAPI.loadProfile();

      if (result.success && result.data) {
        console.log(`User loaded profile from: ${result.path}`);
        loadProfileData(result.data);
        setStatusMessage(`✓ Profile loaded: ${result.path}`);
        showToast('Profile loaded successfully', 'success');
      } else if (!result.canceled) {
        console.error(`Failed to load profile: ${result.error || 'Unknown error'}`);
        showToast(`Failed to load profile: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showToast(`Failed to load profile: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const loadProfileData = (data: any) => {
    if (data.url) setUrl(data.url);
    if (data.fileName) setFileName(data.fileName);
    if (typeof data.debugMode === 'boolean') setDebugMode(data.debugMode);
    if (data.exportFormat) setExportFormat(data.exportFormat);
    if (data.extractors && Array.isArray(data.extractors)) setExtractors(data.extractors);
    if (data.sessionProfileId) setSelectedSessionId(data.sessionProfileId);

    // Set as initial state after loading
    setTimeout(() => {
      saveCurrentStateAsInitial();
    }, 100);
  };

  const handleOpenOutputsFolder = async () => {
    try {
      await window.electronAPI.openOutputsFolder();
    } catch (error) {
      showToast(`Failed to open outputs folder: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleSaveChanges = async () => {
    setShowCloseConfirmation(false);

    // Check if this is a window close action (no pending action) or a profile change
    if (pendingAction) {
      // Profile change/reset scenario
      await handleSaveProfile();
      pendingAction();
      setPendingAction(null);
    } else {
      // Window close scenario
      try {
        const profileData = getCurrentState();
        const result = await window.electronAPI.saveProfile(profileData);

        if (result.success) {
          // Save succeeded, notify main process to proceed with close
          await window.electronAPI.saveCompletedClose();
        }
        // If user canceled save dialog, window will stay open
      } catch (error) {
        console.error('Error during save before close:', error);
        // On error, don't close the window
      }
    }
  };

  const handleDiscardChanges = async () => {
    setShowCloseConfirmation(false);
    setHasUnsavedChanges(false);

    // Check if this is a window close action (no pending action) or a profile change
    if (pendingAction) {
      // Profile change/reset scenario
      pendingAction();
      setPendingAction(null);
    } else {
      // Window close scenario - force close without saving
      await window.electronAPI.forceClose();
    }
  };

  const handleCancelAction = () => {
    setShowCloseConfirmation(false);
    setPendingAction(null);
    // Just close modal, don't close window or execute pending action
  };

  const getExportIcon = (format: ExportFormat) => {
    switch (format) {
      case 'json':
        return <FileJson className="w-4 h-4" />;
      case 'csv':
        return <FileText className="w-4 h-4" />;
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4" />;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[#6fbb69] flex-shrink-0" />;
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    // Auto-select the newly created session
    setSelectedSessionId(sessionId);
    // Trigger refresh of SessionSelector
    setSessionRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-gray-100">
      {/* Custom Title Bar */}
      <CustomTitleBar />

      {/* Header with Menu */}
      <header className="bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-gray-800/50 shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-3">
            {/* Status Display */}
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                status === 'running' ? 'bg-blue-500 animate-pulse' :
                status === 'completed' ? 'bg-green-500' :
                status === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`}></span>
              <span className={`text-sm font-medium ${
                status === 'running' ? 'text-blue-400' :
                status === 'completed' ? 'text-green-400' :
                status === 'error' ? 'text-red-400' :
                'text-gray-300'
              }`}>
                {statusMessage}
              </span>
            </div>

            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Sessions Button */}
            <button
              onClick={() => setShowSessions(true)}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-[#1a1a1a]/50 transition-colors text-sm"
            >
              <Key className="w-4 h-4" />
              <span>Sessions</span>
            </button>

            {/* Files Button */}
            <button
              onClick={() => setShowFiles(true)}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-[#1a1a1a]/50 transition-colors text-sm"
            >
              <Folder className="w-4 h-4" />
              <span>Files</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={handleOpenSettings}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-[#1a1a1a]/50 transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            {/* Credits Button */}
            <button
              onClick={() => setShowCredits(true)}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-[#1a1a1a]/50 transition-colors text-sm"
            >
              <Info className="w-4 h-4" />
              <span>Credits</span>
            </button>
          </div>
        </div>

      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-1/2 border-r border-gray-800/50 overflow-y-auto scrollbar-thin p-6 space-y-6">
          {/* Basic Configuration */}
          <div className="bg-[#0a0a0a]/50 rounded-xl p-6 space-y-4 border border-gray-800/30 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center space-x-2">
              <div className="w-1 h-5 bg-gradient-to-b from-[#6fbb69] to-[#bf8fd7] rounded-full"></div>
              <span>Basic Configuration</span>
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                URL to scrape <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={isRunning}
                className="w-full px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session (Optional)
              </label>
              <SessionSelector
                selectedSessionId={selectedSessionId}
                onSessionSelect={setSelectedSessionId}
                onManageSessions={() => setShowSessions(true)}
                refreshTrigger={sessionRefreshTrigger}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Select a saved session to scrape authenticated/protected content
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  File name (optional)
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="auto-generated"
                  disabled={isRunning}
                  className="w-full px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Export format
                </label>
                <div className="flex space-x-2">
                  {(['json', 'csv', 'excel'] as ExportFormat[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => {
                        console.log(`User changed export format to ${format.toUpperCase()}`);
                        setExportFormat(format);
                      }}
                      disabled={isRunning}
                      className={`flex-1 px-3 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all ${
                        exportFormat === format
                          ? 'bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] text-white shadow-lg'
                          : 'bg-[#1a1a1a]/50 border border-gray-700 hover:border-gray-600 text-gray-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {getExportIcon(format)}
                      <span className="text-xs uppercase font-medium">{format}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Data Extractors */}
          <div className="bg-[#0a0a0a]/50 rounded-xl p-6 space-y-4 border border-gray-800/30 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-200 flex items-center space-x-2">
                <div className="w-1 h-5 bg-gradient-to-b from-[#6fbb69] to-[#bf8fd7] rounded-full"></div>
                <span>Data Extractors</span>
                <span className="text-sm text-gray-400 font-normal">({extractors.length})</span>
              </h2>
              <button
                onClick={addExtractor}
                disabled={isRunning}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Add Extractor</span>
              </button>
            </div>

            {extractors.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#1a1a1a]/50 rounded-full flex items-center justify-center">
                  <Plus className="w-8 h-8" />
                </div>
                <p className="text-sm">No extractors yet. Add one to start extracting data!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {extractors.map((extractor, index) => (
                  <div
                    key={extractor.id}
                    className="bg-[#1a1a1a]/50 rounded-lg p-4 space-y-3 border border-gray-800/50 hover:border-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#6fbb69]">
                        Extractor #{index + 1}
                      </h3>
                      <button
                        onClick={() => removeExtractor(extractor.id)}
                        disabled={isRunning}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Field name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={extractor.fieldName}
                        onChange={(e) => {
                          updateExtractor(extractor.id, 'fieldName', e.target.value);
                          if (e.target.value.trim()) {
                            clearValidationError(extractor.id, 'fieldName');
                          }
                        }}
                        onBlur={(e) => {
                          if (!e.target.value.trim()) {
                            validateExtractor(extractor);
                          }
                        }}
                        placeholder="e.g.: title, price, url"
                        disabled={isRunning}
                        className={`w-full px-3 py-2 bg-[#0a0a0a] border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 placeholder-gray-500 text-sm ${
                          validationErrors[extractor.id]?.fieldName
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-700 focus:ring-[#6fbb69]'
                        }`}
                      />
                      {validationErrors[extractor.id]?.fieldName && (
                        <p className="mt-1 text-xs text-red-400">Field name is required</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        CSS Selector <span className="text-red-400">*</span>
                      </label>
                      <div className="flex space-x-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={extractor.selector || ''}
                            onChange={(e) => {
                              updateExtractor(extractor.id, 'selector', e.target.value);
                              if (e.target.value.trim()) {
                                clearValidationError(extractor.id, 'selector');
                              }
                            }}
                            onBlur={(e) => {
                              if (!e.target.value.trim()) {
                                validateExtractor(extractor);
                              }
                            }}
                            placeholder="e.g.: .product-title, #price"
                            disabled={isRunning || (isPickingElement && pickingExtractorId === extractor.id)}
                            className={`w-full px-3 py-2 bg-[#0a0a0a] border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 placeholder-gray-500 text-sm ${
                              validationErrors[extractor.id]?.selector
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-gray-700 focus:ring-[#6fbb69]'
                            }`}
                          />
                          {validationErrors[extractor.id]?.selector && (
                            <p className="mt-1 text-xs text-red-400">CSS selector is required</p>
                          )}
                        </div>
                        <button
                          onClick={() => handlePickElement(extractor)}
                          disabled={isRunning || isPickingElement}
                          className="px-4 py-2 bg-[#bf8fd7]/80 hover:bg-[#bf8fd7] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm whitespace-nowrap"
                        >
                          <MousePointer className="w-4 h-4" />
                          <span>{pickingExtractorId === extractor.id ? 'Picking...' : 'Pick'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                          Extraction type <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={extractor.extractorType}
                          onChange={(e) => updateExtractor(extractor.id, 'extractorType', e.target.value as ExtractorType)}
                          disabled={isRunning}
                          className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 text-sm"
                        >
                          <option value="text">Element text</option>
                          <option value="attribute">Element attribute</option>
                          <option value="child-link-url">Child link URL</option>
                          <option value="child-link-text">Child link text</option>
                        </select>
                      </div>

                      {extractor.extractorType === 'attribute' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Attribute name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={extractor.attributeName || ''}
                            onChange={(e) => {
                              updateExtractor(extractor.id, 'attributeName', e.target.value);
                              if (e.target.value.trim()) {
                                clearValidationError(extractor.id, 'attributeName');
                              }
                            }}
                            onBlur={(e) => {
                              if (!e.target.value.trim() && extractor.extractorType === 'attribute') {
                                validateExtractor(extractor);
                              }
                            }}
                            placeholder="e.g.: href, src"
                            disabled={isRunning}
                            className={`w-full px-3 py-2 bg-[#0a0a0a] border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 placeholder-gray-500 text-sm ${
                              validationErrors[extractor.id]?.attributeName
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-gray-700 focus:ring-[#6fbb69]'
                            }`}
                          />
                          {validationErrors[extractor.id]?.attributeName && (
                            <p className="mt-1 text-xs text-red-400">Attribute name is required</p>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handlePreviewSelector(extractor)}
                      disabled={isRunning}
                      className="w-full py-2 bg-[#1a1a1a]/50 hover:bg-[#1a1a1a] border border-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview Selector</span>
                    </button>

                    {previewingExtractorId === extractor.id && previewResult && (
                      <div className="mt-3 p-3 bg-[#0a0a0a]/50 rounded-lg border border-gray-800">
                        {previewResult.loading ? (
                          <div className="text-sm text-gray-400">Loading preview...</div>
                        ) : previewResult.success ? (
                          <div className="space-y-2">
                            <div className="text-xs text-[#6fbb69] font-medium">
                              ✓ {previewResult.totalCount} elements found (showing first {previewResult.previewCount})
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                              {previewResult.samples.map((sample: any, idx: number) => (
                                <div key={idx} className="text-xs text-gray-300 bg-[#1a1a1a]/50 px-2 py-1 rounded">
                                  <span className="text-gray-500 mr-2">[{idx + 1}]</span>
                                  {sample || '(empty)'}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-red-400">
                            ✗ Error: {previewResult.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleStartScraping}
              disabled={isRunning}
              className="flex-1 py-3 bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] hover:from-[#8acc85] hover:to-[#d6c1e1] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center space-x-2 font-medium"
            >
              <Play className="w-5 h-5" />
              <span>{isRunning ? 'Extracting...' : 'Start Extraction'}</span>
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#0a0a0a] border border-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Logs */}
          <div className="h-1/2 border-b border-gray-800/50 flex flex-col">
            <div className="bg-[#0a0a0a]/50 px-6 py-3 border-b border-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center space-x-2">
                <div className="w-1 h-4 bg-gradient-to-b from-green-500 to-blue-500 rounded-full"></div>
                <span>Logs</span>
                <span className="text-xs text-gray-400 font-normal">({logs.length})</span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  No logs yet. Start extraction to see logs here.
                </div>
              ) : (
                <>
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-2 text-xs p-2 rounded-lg bg-[#0a0a0a]/30 hover:bg-[#0a0a0a]/50 transition-colors"
                    >
                      {getLogIcon(log.level)}
                      <div className="flex-1">
                        <span className="text-gray-400 mr-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-gray-200">{log.message}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Extracted Data */}
          <div className="h-1/2 flex flex-col">
            <div className="bg-[#0a0a0a]/50 px-6 py-3 border-b border-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center space-x-2">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                <span>Extracted Data</span>
                <span className="text-xs text-gray-400 font-normal">({extractedData.length})</span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {extractedData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  No data extracted yet. Configure extractors and start extraction.
                </div>
              ) : (
                <>
                  {extractedData.map((item, index) => (
                    <div
                      key={index}
                      className="bg-[#0a0a0a]/50 rounded-lg p-4 border border-gray-800/50 space-y-2 hover:border-gray-700/50 transition-colors"
                    >
                      <div className="text-xs font-semibold text-[#bf8fd7] mb-2">
                        Item #{index + 1}
                      </div>
                      {Object.entries(item).map(([key, value]) => (
                        <div key={key} className="flex text-xs">
                          <span className="text-gray-400 font-medium min-w-[100px]">{key}:</span>
                          <span className="text-gray-200 flex-1 break-all">{value || '(empty)'}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div ref={dataEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Transition show={showSettings} as={React.Fragment}>
        <Dialog onClose={() => setShowSettings(false)} className="relative z-50">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-[#0a0a0a] rounded-xl shadow-2xl max-w-2xl w-full border border-gray-800 max-h-[90vh] flex flex-col">
                <div className="p-6 overflow-y-auto scrollbar-thin flex-1 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-[#6fbb69]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Settings className="w-6 h-6 text-[#6fbb69]" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-100">
                        Settings
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-gray-400 mt-1">
                        Configure application folders and preferences
                      </Dialog.Description>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Folders Section */}
                    <div>
                      <h3 className="text-md font-semibold text-gray-200 mb-4 flex items-center space-x-2">
                        <Folder className="w-5 h-5 text-[#6fbb69]" />
                        <span>Folders</span>
                      </h3>
                      <div className="space-y-4">
                        {/* Outputs Folder */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Outputs Folder
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={tempOutputsPath}
                              onChange={(e) => setTempOutputsPath(e.target.value)}
                              className="flex-1 px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all text-gray-100 placeholder-gray-500 text-sm"
                              placeholder="Select outputs folder"
                            />
                            <button
                              onClick={handleSelectOutputsFolder}
                              className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 hover:border-gray-600 rounded-lg transition-colors flex items-center space-x-2 text-sm text-gray-200"
                            >
                              <Folder className="w-4 h-4" />
                              <span>Browse</span>
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Folder where extracted data files will be saved
                          </p>
                        </div>

                        {/* Saves Folder */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Profiles Folder (.b4e)
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={tempSavesPath}
                              onChange={(e) => setTempSavesPath(e.target.value)}
                              className="flex-1 px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all text-gray-100 placeholder-gray-500 text-sm"
                              placeholder="Select profiles folder"
                            />
                            <button
                              onClick={handleSelectSavesFolder}
                              className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 hover:border-gray-600 rounded-lg transition-colors flex items-center space-x-2 text-sm text-gray-200"
                            >
                              <Folder className="w-4 h-4" />
                              <span>Browse</span>
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Default folder for saving and loading .b4e profile files
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Debug & Security Section */}
                    <div className="pt-4 border-t border-gray-800">
                      <h3 className="text-md font-semibold text-gray-200 mb-3 flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                        <span>Debug & Security</span>
                      </h3>
                      <div className="space-y-2">
                        {/* Master Debug Switch */}
                        <label className="flex items-center space-x-3 cursor-pointer p-2.5 rounded-lg hover:bg-[#1a1a1a]/50 transition-colors group">
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={tempDebugEnabled}
                              onChange={(e) => {
                                setTempDebugEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setTempShowBrowser(false);
                                  setTempAdvancedLogs(false);
                                }
                              }}
                              className="peer sr-only"
                            />
                            <div className="w-9 h-5 bg-gray-700 peer-focus:ring-2 peer-focus:ring-[#6fbb69] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#6fbb69] peer-checked:to-[#bf8fd7]"></div>
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                              Debug Mode
                            </span>
                          </div>
                        </label>

                        {/* Sub-options Container */}
                        {tempDebugEnabled && (
                          <div className="ml-4 pl-3 border-l border-gray-700 space-y-1.5">
                            {/* Sub-option 1: Show Browser */}
                            <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-lg hover:bg-[#1a1a1a]/30 transition-colors group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={tempShowBrowser}
                                  onChange={(e) => setTempShowBrowser(e.target.checked)}
                                  className="peer sr-only"
                                />
                                <div className="w-8 h-4 bg-gray-700 peer-focus:ring-1 peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500"></div>
                              </div>
                              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                                Show Browser
                              </span>
                            </label>

                            {/* Sub-option 2: Advanced Logs */}
                            <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-lg hover:bg-[#1a1a1a]/30 transition-colors group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={tempAdvancedLogs}
                                  onChange={(e) => setTempAdvancedLogs(e.target.checked)}
                                  className="peer sr-only"
                                />
                                <div className="w-8 h-4 bg-gray-700 peer-focus:ring-1 peer-focus:ring-purple-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-500"></div>
                              </div>
                              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                                Advanced Logs
                              </span>
                            </label>

                            {/* Sub-option 3: Auto-scroll */}
                            <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-lg hover:bg-[#1a1a1a]/30 transition-colors group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={tempAutoScroll}
                                  onChange={(e) => setTempAutoScroll(e.target.checked)}
                                  className="peer sr-only"
                                />
                                <div className="w-8 h-4 bg-gray-700 peer-focus:ring-1 peer-focus:ring-green-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-green-500"></div>
                              </div>
                              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                                Auto-scroll pages
                              </span>
                            </label>

                            {/* Sub-option 4: Handle Cookies */}
                            <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-lg hover:bg-[#1a1a1a]/30 transition-colors group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={tempHandleCookies}
                                  onChange={(e) => setTempHandleCookies(e.target.checked)}
                                  className="peer sr-only"
                                />
                                <div className="w-8 h-4 bg-gray-700 peer-focus:ring-1 peer-focus:ring-orange-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-orange-500"></div>
                              </div>
                              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                                Handle cookie banners
                              </span>
                            </label>

                            {/* Security Level */}
                            <div className="pt-1.5">
                              <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                                Security Level
                              </label>
                              <select
                                value={tempSecurityLevel}
                                onChange={(e) => setTempSecurityLevel(e.target.value as any)}
                                className="w-full px-2.5 py-1.5 bg-[#0a0a0a] border border-gray-700 rounded-md focus:ring-1 focus:ring-[#6fbb69] focus:border-transparent outline-none transition-all text-gray-100 text-xs"
                              >
                                <option value="relaxed">Relaxed</option>
                                <option value="normal">Normal</option>
                                <option value="strict">Strict</option>
                                <option value="paranoid">Paranoid</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Discord Rich Presence Section */}
                    <div className="pt-4 border-t border-gray-800">
                      <h3 className="text-md font-semibold text-gray-200 mb-4 flex items-center space-x-2">
                        <Settings className="w-5 h-5 text-[#bf8fd7]" />
                        <span>Integrations</span>
                      </h3>
                      <div className="space-y-3">
                        {/* Discord Rich Presence */}
                        <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-[#1a1a1a]/50 transition-colors group">
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={tempDiscordRpc}
                              onChange={(e) => setTempDiscordRpc(e.target.checked)}
                              className="peer sr-only"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-[#6fbb69] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#6fbb69] peer-checked:to-[#bf8fd7]"></div>
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                              Discord Rich Presence
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Display scraping activity on your Discord profile (requires Discord running)
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed footer with buttons - outside scroll area */}
                <div className="p-6 pt-0 flex-shrink-0">
                  <div className="flex space-x-3 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => setShowSettings(false)}
                      className="flex-1 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 hover:border-gray-600 rounded-lg transition-colors text-sm font-medium text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] hover:from-[#8acc85] hover:to-[#d6c1e1] rounded-lg transition-all shadow-lg text-sm font-medium text-white"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Sessions Management Modal */}
      <Transition show={showSessions} as={React.Fragment}>
        <Dialog onClose={() => setShowSessions(false)} className="relative z-50">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-[#0a0a0a] rounded-xl shadow-2xl max-w-3xl w-full border border-gray-800 max-h-[90vh] flex flex-col">
                <div className="p-6 overflow-y-auto scrollbar-thin flex-1">
                  <div className="flex items-start space-x-3 mb-6">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-100">
                        Session Management
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-gray-400 mt-1">
                        Manage your saved login sessions to scrape authenticated content
                      </Dialog.Description>
                    </div>
                  </div>

                  <SessionManager onSessionCreated={handleSessionCreated} />
                </div>

                {/* Fixed footer with close button */}
                <div className="p-6 pt-0 flex-shrink-0">
                  <div className="flex justify-end pt-4 border-t border-gray-800">
                    <button
                      onClick={() => setShowSessions(false)}
                      className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 hover:border-gray-600 rounded-lg transition-colors text-sm font-medium text-gray-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Files Modal */}
      <Transition show={showFiles} as={React.Fragment}>
        <Dialog onClose={() => setShowFiles(false)} className="relative z-50">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-[#0a0a0a] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-800">
                {/* Header */}
                <div className="p-6 flex-shrink-0 border-b border-gray-800">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Folder className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-xl font-semibold text-white">
                        Files Management
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 text-sm text-gray-400">
                        Manage your profiles and access folders
                      </Dialog.Description>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto scrollbar-thin flex-1">
                  {/* Profiles Section */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                      <Save className="w-4 h-4 mr-2" />
                      Profiles
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setShowFiles(false);
                          handleLoadProfile();
                        }}
                        disabled={isRunning}
                        className="w-full px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] disabled:bg-[#0a0a0a] disabled:opacity-50 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors text-left flex items-center space-x-3"
                      >
                        <FolderOpen className="w-5 h-5 text-blue-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Open Profile (.b4e)</div>
                          <div className="text-xs text-gray-500">Load a saved scraping configuration</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowFiles(false);
                          handleSaveProfile();
                        }}
                        disabled={isRunning}
                        className="w-full px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] disabled:bg-[#0a0a0a] disabled:opacity-50 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors text-left flex items-center space-x-3"
                      >
                        <Save className="w-5 h-5 text-green-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Save Profile</div>
                          <div className="text-xs text-gray-500">Save current configuration</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowFiles(false);
                          handleReset();
                        }}
                        disabled={isRunning}
                        className="w-full px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] disabled:bg-[#0a0a0a] disabled:opacity-50 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors text-left flex items-center space-x-3"
                      >
                        <RotateCcw className="w-5 h-5 text-orange-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Reset Profile</div>
                          <div className="text-xs text-gray-500">Clear all configuration and start fresh</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Folders Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                      <Folder className="w-4 h-4 mr-2" />
                      Folders
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setShowFiles(false);
                          handleOpenOutputsFolder();
                        }}
                        className="w-full px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-800 hover:border-gray-700 rounded-lg transition-colors text-left flex items-center space-x-3"
                      >
                        <Folder className="w-5 h-5 text-yellow-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Open Outputs Folder</div>
                          <div className="text-xs text-gray-500">View scraped data files</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>

                      <button
                        onClick={() => {
                          setShowFiles(false);
                          handleOpenSavesFolder();
                        }}
                        className="w-full px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-800 hover:border-gray-700 rounded-lg transition-colors text-left flex items-center space-x-3"
                      >
                        <Folder className="w-5 h-5 text-purple-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">Open Profiles Folder</div>
                          <div className="text-xs text-gray-500">View saved .b4e profile files</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex-shrink-0">
                  <div className="flex justify-end pt-4 border-t border-gray-800">
                    <button
                      onClick={() => setShowFiles(false)}
                      className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-gray-700 hover:border-gray-600 rounded-lg transition-colors text-sm font-medium text-gray-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Visual Picker Result Modal */}
      <Transition show={showPickerResult} as={React.Fragment}>
        <Dialog onClose={() => setShowPickerResult(false)} className="relative z-50">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-[#0a0a0a] rounded-xl shadow-2xl max-w-2xl w-full border border-gray-800">
                <div className="p-6 space-y-4">
                  {pickerResult && pickerResult.error ? (
                    // Error state
                    <>
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <Dialog.Title className="text-lg font-semibold text-gray-100">
                            {pickerResult.cancelled ? 'Selection Cancelled' : 'Error'}
                          </Dialog.Title>
                          <Dialog.Description className="text-sm text-gray-400 mt-1">
                            {pickerResult.error}
                          </Dialog.Description>
                        </div>
                      </div>
                      <div className="flex justify-end pt-4 border-t border-gray-800">
                        <button
                          onClick={() => setShowPickerResult(false)}
                          className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#0a0a0a] border border-gray-800 rounded-lg transition-colors text-sm font-medium"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  ) : pickerResult ? (
                    // Success state
                    <>
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <Dialog.Title className="text-lg font-semibold text-gray-100">
                            Element Selected Successfully
                          </Dialog.Title>
                          <Dialog.Description className="text-sm text-gray-400 mt-1">
                            The element has been analyzed and the extractor has been updated
                          </Dialog.Description>
                        </div>
                      </div>

                      <div className="space-y-3 bg-[#1a1a1a]/50 rounded-lg p-4 border border-gray-800">
                        <div>
                          <div className="text-xs font-medium text-gray-400 mb-1">CSS Selector</div>
                          <div className="text-sm text-gray-200 font-mono bg-[#0a0a0a] px-3 py-2 rounded border border-gray-700">
                            {pickerResult.selector}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-gray-400 mb-1">Tag Name</div>
                            <div className="text-sm text-gray-200 bg-[#0a0a0a] px-3 py-2 rounded border border-gray-700">
                              <span className="font-mono">&lt;{pickerResult.tagName}&gt;</span>
                            </div>
                          </div>
                          {pickerResult.suggestedExtractorType && (
                            <div>
                              <div className="text-xs font-medium text-gray-400 mb-1">Suggested Type</div>
                              <div className="text-sm text-[#6fbb69] bg-[#0a0a0a] px-3 py-2 rounded border border-gray-700 capitalize">
                                {pickerResult.suggestedExtractorType}
                              </div>
                            </div>
                          )}
                        </div>

                        {pickerResult.suggestedAttribute && (
                          <div>
                            <div className="text-xs font-medium text-gray-400 mb-1">Suggested Attribute</div>
                            <div className="text-sm text-[#bf8fd7] bg-[#0a0a0a] px-3 py-2 rounded border border-gray-700 font-mono">
                              {pickerResult.suggestedAttribute}
                            </div>
                          </div>
                        )}

                        {pickerResult.text && (
                          <div>
                            <div className="text-xs font-medium text-gray-400 mb-1">Element Text Preview</div>
                            <div className="text-sm text-gray-200 bg-[#0a0a0a] px-3 py-2 rounded border border-gray-700 max-h-24 overflow-y-auto scrollbar-thin">
                              {pickerResult.text.length > 200
                                ? pickerResult.text.substring(0, 200) + '...'
                                : pickerResult.text || '(empty)'}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end pt-4 border-t border-gray-800">
                        <button
                          onClick={() => setShowPickerResult(false)}
                          className="px-4 py-2.5 bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] hover:from-[#8acc85] hover:to-[#d6c1e1] rounded-lg transition-all shadow-lg text-sm font-medium"
                        >
                          Got it!
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Credits Modal */}
      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />

      {/* Close Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCloseConfirmation}
        onClose={handleCancelAction}
        onSave={handleSaveChanges}
        onDiscard={handleDiscardChanges}
      />
    </div>
  );
}

export default App;
