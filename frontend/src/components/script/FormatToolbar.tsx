import React, { useState } from 'react';
import {
  SwatchIcon,
} from '@heroicons/react/24/outline';

interface FormatToolbarProps {
  onFormatApply: (format: FormatType, value?: string) => void;
  selectedCell?: {
    lineId: string;
    field: string;
  } | null;
  className?: string;
}

export type FormatType = 'bold' | 'italic' | 'underline' | 'color' | 'background';

const FormatToolbar: React.FC<FormatToolbarProps> = ({
  onFormatApply,
  selectedCell,
  className = '',
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Function to check if a format is currently applied to selected cell
  const isFormatApplied = (format: FormatType): boolean => {
    if (!selectedCell) return false;
    
    // Get the cell element to check the HTML content
    const cellElement = document.querySelector(`[data-line-id="${selectedCell.lineId}"][data-field="${selectedCell.field}"]`);
    if (!cellElement) return false;
    
    const htmlContent = cellElement.innerHTML;
    
    console.log('Checking cell format:', format, 'in HTML:', htmlContent);
    
    // Check if the entire cell has the corresponding formatting applied
    switch (format) {
      case 'bold':
        return htmlContent.startsWith('<strong>') && htmlContent.endsWith('</strong>') ||
               htmlContent.startsWith('<b>') && htmlContent.endsWith('</b>');
      case 'italic':
        return htmlContent.startsWith('<em>') && htmlContent.endsWith('</em>') ||
               htmlContent.startsWith('<i>') && htmlContent.endsWith('</i>');
      case 'underline':
        return htmlContent.startsWith('<u>') && htmlContent.endsWith('</u>');
      case 'color':
        return /^<span[^>]*style="[^"]*color:[^"]*"[^>]*>.*<\/span>$/.test(htmlContent);
      case 'background':
        return /^<span[^>]*style="[^"]*background-color:[^"]*"[^>]*>.*<\/span>$/.test(htmlContent);
      default:
        return false;
    }
  };

  const colors = [
    { name: '黒', value: '#000000' },
    { name: '青', value: '#3B82F6' },
    { name: '赤', value: '#EF4444' },
    { name: '緑', value: '#10B981' },
    { name: '紫', value: '#8B5CF6' },
    { name: 'オレンジ', value: '#F59E0B' },
    { name: 'グレー', value: '#6B7280' },
  ];

  const backgroundColors = [
    { name: '透明', value: 'transparent' },
    { name: '黄色', value: '#FEF3C7' },
    { name: 'ピンク', value: '#FCE7F3' },
    { name: '青', value: '#DBEAFE' },
    { name: '緑', value: '#D1FAE5' },
    { name: 'グレー', value: '#F3F4F6' },
  ];

  const handleFormatClick = (format: FormatType) => {
    console.log('Format click:', format);
    
    if (format === 'color') {
      setShowColorPicker(!showColorPicker);
      setShowBackgroundPicker(false);
    } else if (format === 'background') {
      setShowBackgroundPicker(!showBackgroundPicker);
      setShowColorPicker(false);
    } else {
      setIsApplying(true);
      // Apply format immediately
      onFormatApply(format);
      // Reset state after a short delay
      setTimeout(() => {
        setIsApplying(false);
        setShowColorPicker(false);
        setShowBackgroundPicker(false);
      }, 100);
    }
  };

  const handleColorSelect = (color: string, isBackground: boolean) => {
    console.log('Color select:', { color, isBackground });
    
    setIsApplying(true);
    // Apply format immediately
    onFormatApply(isBackground ? 'background' : 'color', color);
    // Reset state after a short delay
    setTimeout(() => {
      setIsApplying(false);
      setShowColorPicker(false);
      setShowBackgroundPicker(false);
    }, 100);
  };

  return (
    <div className={`relative format-toolbar ${className}`}>
      <div className="flex items-center space-x-1 p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
        {isApplying && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
        {/* Bold */}
        <button
          onClick={() => handleFormatClick('bold')}
          disabled={isApplying || !selectedCell}
          className={`p-2 rounded transition-colors duration-200 disabled:opacity-50 ${
            isFormatApplied('bold') 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="太字"
          onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </button>

        {/* Italic */}
        <button
          onClick={() => handleFormatClick('italic')}
          disabled={isApplying || !selectedCell}
          className={`p-2 rounded transition-colors duration-200 disabled:opacity-50 ${
            isFormatApplied('italic') 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="斜体"
          onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4l4 16M6 8h12M4 16h12" />
          </svg>
        </button>

        {/* Underline */}
        <button
          onClick={() => handleFormatClick('underline')}
          disabled={isApplying || !selectedCell}
          className={`p-2 rounded transition-colors duration-200 disabled:opacity-50 ${
            isFormatApplied('underline') 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="下線"
          onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 20h12M8 4v8a4 4 0 008 0V4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Text Color */}
        <button
          onClick={() => handleFormatClick('color')}
          disabled={isApplying || !selectedCell}
          className={`p-2 rounded transition-colors duration-200 disabled:opacity-50 ${
            isFormatApplied('color') 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="文字色"
          onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
        >
          <SwatchIcon className="h-4 w-4" />
        </button>

        {/* Background Color */}
        <button
          onClick={() => handleFormatClick('background')}
          disabled={isApplying || !selectedCell}
          className={`p-2 rounded transition-colors duration-200 disabled:opacity-50 ${
            isFormatApplied('background') 
              ? 'bg-blue-100 text-blue-700 border border-blue-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="背景色"
          onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21a4 4 0 004-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4" />
          </svg>
        </button>
      </div>

      {/* Color Picker */}
      {showColorPicker && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="text-xs font-medium text-gray-700 mb-2">文字色を選択</div>
          <div className="grid grid-cols-4 gap-2">
            {colors.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorSelect(color.value, false)}
                onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
                className="w-8 h-8 rounded border border-gray-300 hover:border-gray-400 transition-colors duration-200"
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Background Color Picker */}
      {showBackgroundPicker && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="text-xs font-medium text-gray-700 mb-2">背景色を選択</div>
          <div className="grid grid-cols-3 gap-2">
            {backgroundColors.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorSelect(color.value, true)}
                onMouseDown={(e) => e.preventDefault()} // Prevent selection clearing
                className="w-8 h-8 rounded border border-gray-300 hover:border-gray-400 transition-colors duration-200"
                style={{ 
                  backgroundColor: color.value === 'transparent' ? '#ffffff' : color.value,
                  backgroundImage: color.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none',
                  backgroundSize: color.value === 'transparent' ? '8px 8px' : 'auto',
                  backgroundPosition: color.value === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : 'auto'
                }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormatToolbar;