import React, { useEffect } from "react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: string[];
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, lines }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" data-modal-open="true">
      <div className="bg-slate-900 text-slate-200 rounded-lg shadow-xl max-w-xl w-full p-6 border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Dojo Command Help</h2>
        <pre className="whitespace-pre-wrap text-sm font-mono mb-6">
          {lines.join("\n")}
        </pre>
        <button
          onClick={onClose}
          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
};

export default HelpModal;
