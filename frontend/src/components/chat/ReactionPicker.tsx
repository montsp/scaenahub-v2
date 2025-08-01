import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import './ReactionPicker.css';

interface ReactionPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onEmojiSelect,
  onClose,
  className = '',
  triggerRef,
}) => {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Quick reaction emojis
  const quickReactions = [
    '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉', '👏', '🔥'
  ];

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    onClose();
  };

  const handleQuickReaction = (emoji: string) => {
    onEmojiSelect(emoji);
    onClose();
  };

  // Calculate optimal position based on available space
  useEffect(() => {
    if (triggerRef?.current && pickerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const pickerHeight = showFullPicker ? 450 : 200; // Estimated heights
      const viewportHeight = window.innerHeight;
      
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      
      // Choose position based on available space
      if (spaceBelow >= pickerHeight || spaceBelow >= spaceAbove) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [triggerRef, showFullPicker]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const positionClasses = position === 'top' 
    ? 'bottom-full mb-2' 
    : 'top-full mt-2';

  return (
    <div 
      ref={pickerRef} 
      className={`absolute ${positionClasses} right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 ${className}`}
    >
      {!showFullPicker ? (
        <div className="p-4 min-w-[280px]">
          {/* Quick reactions */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleQuickReaction(emoji)}
                className="w-12 h-12 flex items-center justify-center text-2xl hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-transparent hover:border-gray-300"
                title={`リアクション: ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Show more button */}
          <button
            onClick={() => setShowFullPicker(true)}
            className="w-full px-4 py-3 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200 border border-gray-200 font-medium"
          >
            その他の絵文字を選択...
          </button>
        </div>
      ) : (
        <div className="p-3">
          {/* Back button */}
          <div className="mb-3 pb-2 border-b border-gray-200">
            <button
              onClick={() => setShowFullPicker(false)}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>クイックリアクションに戻る</span>
            </button>
          </div>

          {/* Full emoji picker */}
          <div className="emoji-picker-container">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={320}
              height={400}
              searchDisabled={false}
              skinTonesDisabled={true}
              previewConfig={{
                showPreview: false
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;