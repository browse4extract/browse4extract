import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, FileText, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [changelog, setChangelog] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchChangelog();
    }
  }, [isOpen]);

  const fetchChangelog = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/browse4extract/browse4extract/refs/heads/master/CHANGELOG.md'
      );
      if (!response.ok) {
        throw new Error('Failed to fetch changelog');
      }
      const text = await response.text();
      setChangelog(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

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
              <Dialog.Panel className="bg-[#0a0a0a] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-800">
                {/* Header */}
                <div className="p-6 flex-shrink-0 border-b border-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6fbb69] to-[#bf8fd7] flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <Dialog.Title className="text-2xl font-semibold text-gray-100">
                          Changelog
                        </Dialog.Title>
                        <p className="text-sm text-gray-400 mt-1">
                          Browse4Extract version history
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-[#1a1a1a] rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Loader2 className="w-12 h-12 text-[#6fbb69] animate-spin mb-4" />
                      <p className="text-gray-400">Loading changelog...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                      <p className="text-gray-400 mb-4">Failed to load changelog</p>
                      <p className="text-sm text-gray-500">{error}</p>
                      <button
                        onClick={fetchChangelog}
                        className="mt-4 px-4 py-2 bg-gradient-to-r from-[#6fbb69] to-[#bf8fd7] text-white rounded-lg hover:opacity-90 transition-all"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!loading && !error && changelog && (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-3xl font-bold text-gray-100 mb-4 pb-3 border-b border-gray-800">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-2xl font-semibold text-gray-200 mt-8 mb-3 flex items-center gap-2">
                              <div className="w-1 h-6 bg-gradient-to-b from-[#6fbb69] to-[#bf8fd7] rounded-full"></div>
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-xl font-semibold text-gray-300 mt-6 mb-2">
                              {children}
                            </h3>
                          ),
                          h4: ({ children }) => (
                            <h4 className="text-lg font-medium text-gray-400 mt-4 mb-2">
                              {children}
                            </h4>
                          ),
                          p: ({ children }) => (
                            <p className="text-gray-400 mb-3 leading-relaxed">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-none space-y-2 mb-4">
                              {children}
                            </ul>
                          ),
                          li: ({ children }) => (
                            <li className="text-gray-400 flex items-start">
                              <span className="text-[#6fbb69] mr-2 mt-1">•</span>
                              <span>{children}</span>
                            </li>
                          ),
                          code: ({ children, className }) => {
                            const inline = !className;
                            if (inline) {
                              return (
                                <code className="text-[#6fbb69] bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm font-mono">
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <code className="block bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-gray-300 text-sm font-mono overflow-x-auto">
                                {children}
                              </code>
                            );
                          },
                          pre: ({ children }) => (
                            <pre className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 overflow-x-auto mb-4">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-[#6fbb69] pl-4 py-2 my-4 bg-[#1a1a1a]/50 rounded-r-lg">
                              {children}
                            </blockquote>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#6fbb69] hover:text-[#bf8fd7] transition-colors underline"
                            >
                              {children}
                            </a>
                          ),
                          strong: ({ children }) => (
                            <strong className="text-gray-200 font-semibold">
                              {children}
                            </strong>
                          ),
                        }}
                      >
                        {changelog}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ChangelogModal;
