import React, { useState, useRef, useEffect } from 'react';

interface ScriptCellProps {
  value: string;
  isEditing: boolean;
  canEdit: boolean;
  onEdit: (value: string) => void;
  onFocus: () => void;
  onBlur?: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  dataLineId: string;
  dataField: string;
}

const ScriptCell: React.FC<ScriptCellProps> = ({
  value,
  isEditing,
  canEdit,
  onEdit,
  onFocus,
  onBlur,
  onKeyDown,
  className = '',
  placeholder = '',
  multiline = false,
  dataLineId,
  dataField,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      } else if (inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.setSelectionRange(0, inputRef.current.value.length);
      }
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onEdit(localValue);
    }
    if (onBlur) {
      onBlur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      if (localValue !== value) {
        onEdit(localValue);
      }
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      (e.target as HTMLElement).blur();
    }
    
    onKeyDown(e);
  };

  const handleClick = () => {
    if (canEdit && !isEditing) {
      onFocus();
    }
  };

  const cellContent = (
    <div
      className={`
        w-full h-full p-2 cursor-text transition-colors duration-200 script-cell
        ${className}
        ${canEdit ? 'hover:bg-blue-50' : ''}
        ${isEditing ? 'bg-blue-50 ring-2 ring-blue-500' : ''}
        ${isHovered && canEdit ? 'bg-gray-50' : ''}
        ${!value.trim() ? 'empty-cell' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-line-id={dataLineId}
      data-field={dataField}
    >
      {isEditing ? (
        multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full resize-none border-none outline-none bg-transparent"
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full border-none outline-none bg-transparent"
            placeholder={placeholder}
          />
        )
      ) : (
        <div className="w-full h-full whitespace-pre-wrap break-words">
          {value || (
            <span className="text-gray-400 italic placeholder-text">
              {placeholder}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return cellContent;
};

export default ScriptCell;