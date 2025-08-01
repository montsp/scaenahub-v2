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
    // When editing, show plain text; when not editing, show HTML
    if (isEditing) {
      setLocalValue(getPlainText(value));
    } else {
      setLocalValue(value);
    }
  }, [value, isEditing]);

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

  // Helper function to get plain text from HTML
  const getPlainText = (html: string): string => {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const handleBlur = () => {
    // When editing ends, compare with plain text version
    const currentPlainText = getPlainText(value);
    if (localValue !== currentPlainText) {
      onEdit(localValue);
    }
    if (onBlur) {
      onBlur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      const currentPlainText = getPlainText(value);
      if (localValue !== currentPlainText) {
        onEdit(localValue);
      }
    } else if (e.key === 'Escape') {
      setLocalValue(getPlainText(value));
      (e.target as HTMLElement).blur();
    }
    
    onKeyDown(e);
  };

  const handleClick = () => {
    if (canEdit && !isEditing) {
      onFocus();
      
      // Emit cell selection event for format toolbar
      const event = new CustomEvent('cellSelected', {
        detail: {
          lineId: dataLineId,
          field: dataField,
        }
      });
      window.dispatchEvent(event);
    }
  };

  const handleTextSelection = () => {
    if (!canEdit || isEditing) return;
    
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();
        
        // Get the cell element to work with its text content
        const cellElement = document.querySelector(`[data-line-id="${dataLineId}"][data-field="${dataField}"]`);
        if (!cellElement) return;
        
        // Get the plain text content of the cell
        const plainTextContent = cellElement.textContent || '';
        
        // Calculate offsets based on plain text
        let startOffset = 0;
        let endOffset = 0;
        
        // Find the selected text position in the plain text
        // Calculate position based on plain text content
        // This approach works better with HTML content
        const selectionRange = selection.getRangeAt(0);
        
        // Create a temporary element to get the text before selection
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cellElement.innerHTML;
        
        // Get all text nodes and calculate offset
        const walker = document.createTreeWalker(
          cellElement,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let currentOffset = 0;
        let node;
        let foundStart = false;
        
        while (node = walker.nextNode()) {
          const nodeLength = node.textContent?.length || 0;
          
          if (node === selectionRange.startContainer) {
            startOffset = currentOffset + selectionRange.startOffset;
            foundStart = true;
          }
          
          if (node === selectionRange.endContainer) {
            endOffset = currentOffset + selectionRange.endOffset;
            break;
          }
          
          if (!foundStart) {
            currentOffset += nodeLength;
          }
        }
        
        // Fallback: if we couldn't calculate based on DOM, use text search
        if (!foundStart) {
          const selectedTextIndex = plainTextContent.indexOf(selectedText);
          if (selectedTextIndex !== -1) {
            startOffset = selectedTextIndex;
            endOffset = selectedTextIndex + selectedText.length;
          }
        }
        
        console.log('Text selected:', { selectedText, startOffset, endOffset, lineId: dataLineId, field: dataField, plainTextContent });
        
        // Emit text selection event for format toolbar
        const event = new CustomEvent('textSelected', {
          detail: {
            lineId: dataLineId,
            field: dataField,
            text: selectedText,
            startOffset: startOffset,
            endOffset: endOffset,
          }
        });
        window.dispatchEvent(event);
      }
    }, 10);
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
      onMouseUp={handleTextSelection}
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
        value ? (
          <div 
            className="w-full h-full whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: value }}
            style={{ 
              // Hide HTML tags in contentEditable mode
              WebkitUserSelect: 'text',
              userSelect: 'text'
            }}
          />
        ) : (
          <div className="w-full h-full whitespace-pre-wrap break-words">
            <span className="text-gray-400 italic placeholder-text">
              {placeholder}
            </span>
          </div>
        )
      )}
    </div>
  );

  return cellContent;
};

export default ScriptCell;