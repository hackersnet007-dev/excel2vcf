import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Sparkles } from 'lucide-react';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndPassFile = (file: File) => {
    setError(null);
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    // Some browsers might not detect MIME types for Excel correctly, so check extension too
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');

    if (validTypes.includes(file.type) || validExtensions.includes(extension)) {
      onFileSelect(file);
    } else {
      setError("Please upload a valid Excel (.xlsx, .xls) or CSV file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFile(e.target.files[0]);
    }
    // Reset the value so the same file can be selected again if needed
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50 scale-102' 
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          className="hidden"
          accept=".xlsx, .xls, .csv"
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-full ${isDragging ? 'bg-indigo-100' : 'bg-gray-100'}`}>
            <FileSpreadsheet className={`w-10 h-10 ${isDragging ? 'text-indigo-600' : 'text-gray-500'}`} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Upload your Contact List
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Drag & drop your Excel file here, or click to browse.
            </p>
            <p className="text-xs text-gray-400">
              Supports .xlsx, .xls, .csv
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors focus:ring-4 focus:ring-gray-200"
          >
            Browse Files
          </button>
        </div>

        {error && (
          <div className="absolute -bottom-16 left-0 right-0">
             <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
             </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center space-x-4">
          <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
            <Sparkles size={20} />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-0.5">Smart Detection</span>
            <p className="text-sm text-gray-600">
              We automatically detect the <span className="font-semibold text-gray-800">Name</span> and <span className="font-semibold text-gray-800">Phone Number</span> columns, no matter where they are.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};