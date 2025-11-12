import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Layers, Puzzle, Code, Sparkles, ExternalLink } from 'lucide-react';
import packageJson from '../../../package.json';
import { getFullVersionString } from '../utils/buildInfo';
import appIcon from '../assets/app_image.png';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Type pour une dépendance
interface Dependency {
  name: string;
  displayName: string;
  version: string;
  description: string;
  license: string;
}

// Type pour un outil B4E custom
interface B4ETool {
  name: string;
  displayName: string;
  description: string;
  technology: string;
}

const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  // Fonction helper pour extraire la version sans le préfixe ^
  const getVersion = (pkg: string, isDev = false): string => {
    const deps: Record<string, string> = isDev
      ? (packageJson.devDependencies as Record<string, string>)
      : (packageJson.dependencies as Record<string, string>);
    const version = deps[pkg];
    return version ? version.replace(/^[\^~]/, '') : 'N/A';
  };

  // Technologies principales
  const coreTechnologies: Dependency[] = [
    {
      name: 'electron',
      displayName: 'Electron',
      version: getVersion('electron', true),
      description: 'Cross-platform desktop framework',
      license: 'MIT'
    },
    {
      name: 'react',
      displayName: 'React',
      version: getVersion('react'),
      description: 'UI library for building interfaces',
      license: 'MIT'
    },
    {
      name: 'typescript',
      displayName: 'TypeScript',
      version: getVersion('typescript', true),
      description: 'Typed superset of JavaScript',
      license: 'Apache-2.0'
    },
    {
      name: 'tailwindcss',
      displayName: 'Tailwind CSS',
      version: getVersion('tailwindcss', true),
      description: 'Utility-first CSS framework',
      license: 'MIT'
    },
    {
      name: 'puppeteer',
      displayName: 'Puppeteer',
      version: getVersion('puppeteer'),
      description: 'Headless browser automation',
      license: 'Apache-2.0'
    },
    {
      name: 'exceljs',
      displayName: 'ExcelJS',
      version: getVersion('exceljs'),
      description: 'Excel spreadsheet generation',
      license: 'MIT'
    }
  ];

  // Bibliothèques UI
  const uiLibraries: Dependency[] = [
    {
      name: '@headlessui/react',
      displayName: 'Headless UI',
      version: getVersion('@headlessui/react'),
      description: 'Accessible UI components',
      license: 'MIT'
    },
    {
      name: 'lucide-react',
      displayName: 'Lucide React',
      version: getVersion('lucide-react'),
      description: 'Beautiful icon library',
      license: 'ISC'
    },
    {
      name: '@heroicons/react',
      displayName: 'Heroicons',
      version: getVersion('@heroicons/react'),
      description: 'Hand-crafted SVG icons',
      license: 'MIT'
    }
  ];

  // Outils de support
  const supportTools: Dependency[] = [
    {
      name: 'discord-rpc',
      displayName: 'Discord RPC',
      version: getVersion('discord-rpc'),
      description: 'Discord Rich Presence integration',
      license: 'MIT'
    },
    {
      name: 'puppeteer-extra',
      displayName: 'Puppeteer Extra',
      version: getVersion('puppeteer-extra'),
      description: 'Puppeteer plugin framework',
      license: 'MIT'
    },
    {
      name: 'puppeteer-extra-plugin-stealth',
      displayName: 'Puppeteer Stealth',
      version: getVersion('puppeteer-extra-plugin-stealth'),
      description: 'Stealth plugin for undetected scraping',
      license: 'MIT'
    },
    {
      name: 'puppeteer-extra-plugin-adblocker',
      displayName: 'Puppeteer AdBlocker',
      version: getVersion('puppeteer-extra-plugin-adblocker'),
      description: 'Ad blocking for faster scraping',
      license: 'MIT'
    }
  ];

  // Outils B4E Custom
  const b4eCustomTools: B4ETool[] = [
    {
      name: 'b4e-puppeteer-element_picker',
      displayName: 'Element Picker',
      description: 'Visual element selection with interactive overlay',
      technology: 'Puppeteer'
    },
    {
      name: 'b4e-puppeteer-cookie_handler',
      displayName: 'Cookie Handler',
      description: 'Auto-dismiss cookie consent banners',
      technology: 'Puppeteer'
    },
    {
      name: 'b4e-security-network_monitor',
      displayName: 'Network Security Monitor',
      description: 'Network traffic analysis with threat detection',
      technology: 'Security'
    },
    {
      name: 'b4e-electron-session_manager',
      displayName: 'Session Manager',
      description: 'Encrypted session storage with safeStorage',
      technology: 'Electron'
    },
    {
      name: 'b4e-core-logger',
      displayName: 'Logger System',
      description: 'Advanced logging with sensitive data sanitization',
      technology: 'Core'
    },
    {
      name: 'b4e-antidetection-system_info',
      displayName: 'System Info Detector',
      description: 'System fingerprinting for realistic browser signatures',
      technology: 'Anti-detection'
    }
  ];

  // Grouper les licences
  const licenseGroups = {
    MIT: [...coreTechnologies, ...uiLibraries, ...supportTools].filter(dep => dep.license === 'MIT'),
    'Apache-2.0': [...coreTechnologies, ...uiLibraries, ...supportTools].filter(dep => dep.license === 'Apache-2.0'),
    ISC: [...coreTechnologies, ...uiLibraries, ...supportTools].filter(dep => dep.license === 'ISC')
  };

  // Composant pour afficher une carte de dépendance
  const DependencyCard: React.FC<{ dep: Dependency }> = ({ dep }) => (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-white font-medium text-sm">{dep.displayName}</h4>
        <span className="text-xs text-[#6fbb69] font-mono bg-[#6fbb69]/10 px-2 py-0.5 rounded">
          v{dep.version}
        </span>
      </div>
      <p className="text-xs text-gray-400">{dep.description}</p>
    </div>
  );

  // Composant pour afficher un outil B4E
  const B4EToolCard: React.FC<{ tool: B4ETool }> = ({ tool }) => (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-white font-medium text-sm">{tool.displayName}</h4>
        <span className="text-xs text-[#6fbb69] font-mono bg-[#6fbb69]/10 px-2 py-0.5 rounded">
          B4E
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-1">{tool.description}</p>
      <p className="text-xs text-gray-500 font-mono">{tool.name}</p>
    </div>
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="bg-[#0a0a0a] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-800">
                {/* Header */}
                <div className="p-6 flex-shrink-0 border-b border-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={appIcon} alt="Browse4Extract" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <Dialog.Title className="text-2xl font-bold bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] bg-clip-text text-transparent mb-1">
                          Browse4Extract
                        </Dialog.Title>
                        <p className="text-sm text-gray-400">
                          Version {getFullVersionString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  {/* Core Technologies */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-5 h-5 text-[#6fbb69]" />
                      <h3 className="text-lg font-semibold text-white">Core Technologies</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {coreTechnologies.map(dep => (
                        <DependencyCard key={dep.name} dep={dep} />
                      ))}
                    </div>
                  </div>

                  {/* UI Libraries */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Puzzle className="w-5 h-5 text-[#bf8fd7]" />
                      <h3 className="text-lg font-semibold text-white">UI Components</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {uiLibraries.map(dep => (
                        <DependencyCard key={dep.name} dep={dep} />
                      ))}
                    </div>
                  </div>

                  {/* Support Tools */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Code className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">Support Tools</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {supportTools.map(dep => (
                        <DependencyCard key={dep.name} dep={dep} />
                      ))}
                    </div>
                  </div>

                  {/* B4E Custom Tools */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-[#6fbb69]" />
                      <h3 className="text-lg font-semibold text-white">B4E Custom Tools</h3>
                    </div>
                    <div className="bg-[#6fbb69]/5 border border-[#6fbb69]/20 rounded-lg p-3 mb-3">
                      <p className="text-xs text-gray-300">
                        Browse4Extract includes custom-built tools and enhancements to provide unique features not available in standard libraries.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {b4eCustomTools.map(tool => (
                        <B4EToolCard key={tool.name} tool={tool} />
                      ))}
                    </div>
                  </div>

                  {/* Licenses */}
                  <div className="border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Open Source Licenses</h3>
                    <div className="space-y-4">
                      {Object.entries(licenseGroups).map(([license, deps]) => (
                        deps.length > 0 && (
                          <div key={license} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-[#6fbb69] mb-2">{license} License</h4>
                            <div className="flex flex-wrap gap-2">
                              {deps.map(dep => (
                                <span
                                  key={dep.name}
                                  className="text-xs text-[#6fbb69] bg-gray-800 px-2 py-1 rounded"
                                >
                                  {dep.displayName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>

                  {/* About */}
                  <div className="border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-3">About</h3>
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-300">
                        {packageJson.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <a
                          href={packageJson.homepage}
                          onClick={(e) => {
                            e.preventDefault();
                            window.electronAPI.openExternal(packageJson.homepage);
                          }}
                          className="inline-flex items-center gap-1.5 text-[#6fbb69] hover:text-[#8acc85] transition-colors cursor-pointer"
                        >
                          <span>Website</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <span className="text-gray-600">•</span>
                        <a
                          href={packageJson.repository.url.replace('git+', '').replace('.git', '')}
                          onClick={(e) => {
                            e.preventDefault();
                            const url = packageJson.repository.url.replace('git+', '').replace('.git', '');
                            window.electronAPI.openExternal(url);
                          }}
                          className="inline-flex items-center gap-1.5 text-[#6fbb69] hover:text-[#8acc85] transition-colors cursor-pointer"
                        >
                          <span>GitHub Repository</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <span className="text-gray-600">•</span>
                        <a
                          href={packageJson.bugs.url}
                          onClick={(e) => {
                            e.preventDefault();
                            window.electronAPI.openExternal(packageJson.bugs.url);
                          }}
                          className="inline-flex items-center gap-1.5 text-[#6fbb69] hover:text-[#8acc85] transition-colors cursor-pointer"
                        >
                          <span>Report Issues</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
                        © {new Date().getFullYear()} B4E Team. Licensed under {packageJson.license}.
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreditsModal;
