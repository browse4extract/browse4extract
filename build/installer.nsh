!macro preInit
  ; Set default installation directory to SieApps\Browse4Extract
  ; This macro is executed before the installer initializes

  ; 64-bit registry entries
  SetRegView 64
  ; For per-machine installations (admin)
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES64\SieApps\Browse4Extract"
  ; For current user installations (non-admin)
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\SieApps\Browse4Extract"

  ; 32-bit registry entries (for compatibility)
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES\SieApps\Browse4Extract"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\SieApps\Browse4Extract"
!macroend
