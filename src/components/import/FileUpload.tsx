'use client';

import React, { useRef, useState } from 'react';
import { Upload, File, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onUpload: (fileName: string, content: string) => void;
  loading?: boolean;
}

export function FileUpload({ onUpload, loading = false }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a valid CSV file.');
      return;
    }
    setError('');
    setSelectedFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onUpload(file.name, text);
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 p-3 rounded-lg text-xs font-semibold">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        id="file-upload-dropzone"
        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          dragActive
            ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900/60'
            : 'border-zinc-200 hover:border-zinc-400 bg-white/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900/20'
        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          id="file-upload-input"
          className="hidden"
          disabled={loading}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800/80 rounded-full text-zinc-500">
            {selectedFileName ? <File size={24} /> : <Upload size={24} />}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {selectedFileName ? selectedFileName : 'Drag & Drop CSV File'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {loading ? 'Processing upload...' : 'or click to browse from finder'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
