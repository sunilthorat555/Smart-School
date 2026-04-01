import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}) => {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          button: 'bg-red-600 hover:bg-red-700',
          icon: 'text-red-600 bg-red-50',
          border: 'border-red-100'
        };
      case 'warning':
        return {
          button: 'bg-amber-600 hover:bg-amber-700',
          icon: 'text-amber-600 bg-amber-50',
          border: 'border-amber-100'
        };
      default:
        return {
          button: 'bg-blue-600 hover:bg-blue-700',
          icon: 'text-blue-600 bg-blue-50',
          border: 'border-blue-100'
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-2xl ${colors.icon}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 mb-8">{message}</p>
          
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 text-white font-bold rounded-2xl transition-all shadow-lg ${colors.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
