import { useState, useRef, useEffect } from 'react';
import EmojiPickerReact from 'emoji-picker-react';

export default function EmojiPicker({ value, onChange, placeholder = "😀" }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  // Cerrar picker al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  const onEmojiClick = (emojiObject) => {
    onChange(emojiObject.emoji);
    setShowPicker(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '16px'
          }}
        />
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          style={{
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '20px',
            minWidth: '50px',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
        >
          😀
        </button>
      </div>

      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}
        >
          <EmojiPickerReact
            onEmojiClick={onEmojiClick}
            width={350}
            height={400}
            previewConfig={{ showPreview: false }}
            searchPlaceHolder="Buscar emoji..."
            categories={[
              { name: 'Smileys & People', category: 'smileys_people' },
              { name: 'Animals & Nature', category: 'animals_nature' },
              { name: 'Food & Drink', category: 'food_drink' },
              { name: 'Travel & Places', category: 'travel_places' },
              { name: 'Activities', category: 'activities' },
              { name: 'Objects', category: 'objects' },
              { name: 'Symbols', category: 'symbols' },
              { name: 'Flags', category: 'flags' }
            ]}
          />
        </div>
      )}
    </div>
  );
}
