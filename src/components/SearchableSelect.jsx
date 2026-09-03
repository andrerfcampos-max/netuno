import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';

const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const SearchableSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecione ou digite para buscar...',
  icon: Icon = null,
  allowCustom = false,
  clearable = true,
  disabled = false,
  className = '',
  dropdownClassName = '',
  name = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : (opt.name || ''),
          label: opt.label !== undefined ? opt.label : (opt.name || String(opt.value || '')),
          subtitle: opt.subtitle || null
        };
      }
      return {
        value: String(opt),
        label: String(opt),
        subtitle: null
      };
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find(opt => opt.value === value) || null;
  }, [normalizedOptions, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const queryNorm = normalizeText(searchQuery);
    return normalizedOptions.filter(opt => {
      const labelNorm = normalizeText(opt.label);
      const valNorm = normalizeText(opt.value);
      const subNorm = normalizeText(opt.subtitle || '');
      return labelNorm.includes(queryNorm) || valNorm.includes(queryNorm) || subNorm.includes(queryNorm);
    });
  }, [normalizedOptions, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      if (selectedOption) {
        setSearchQuery(selectedOption.label);
      } else if (value && allowCustom) {
        setSearchQuery(String(value));
      } else {
        setSearchQuery('');
      }
      setHighlightedIndex(-1);
    }
  }, [isOpen, selectedOption, value, allowCustom]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue) => {
    onChange && onChange(optionValue);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange && onChange('');
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
      if (inputRef.current) inputRef.current.select();
    }
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setSearchQuery(text);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);
    if (allowCustom && text.trim() === '') {
      onChange && onChange('');
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (allowCustom && searchQuery.trim()) {
          handleSelect(searchQuery.trim());
        }
      } else {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const hasValue = Boolean(value || (allowCustom && searchQuery.trim()));
  const isCustomTyped = allowCustom && searchQuery.trim() && !normalizedOptions.some(opt => normalizeText(opt.value) === normalizeText(searchQuery));

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div 
        className={`flex items-center w-full rounded-lg transition-all border ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-slate-800'
            : hasValue
            ? 'border-emerald-500/60 bg-slate-800'
            : 'border-slate-700 bg-slate-800/80 hover:border-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => {
          if (!disabled && inputRef.current) {
            inputRef.current.focus();
            setIsOpen(true);
          }
        }}
      >
        <div className="pl-2.5 pr-1.5 flex items-center justify-center text-slate-400 shrink-0 pointer-events-none">
          {Icon ? <Icon size={14} className={isOpen || hasValue ? 'text-emerald-400' : 'text-slate-400'} /> : <Search size={13} className={isOpen ? 'text-emerald-400' : 'text-slate-400'} />}
        </div>

        <input
          ref={inputRef}
          name={name}
          type="text"
          disabled={disabled}
          value={isOpen ? searchQuery : (selectedOption ? selectedOption.label : (allowCustom ? value : ''))}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-8 sm:h-9 bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none pr-1 truncate font-medium"
          autoComplete="off"
        />

        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors rounded-full shrink-0 cursor-pointer mr-0.5"
            title="Limpar seleção"
          >
            <X size={13} />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(prev => !prev);
          }}
          className="pr-2.5 pl-1 text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div 
          ref={listRef}
          className={`absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[250] py-1 text-xs sm:text-sm animate-fadeIn ${dropdownClassName}`}
          style={{ scrollbarWidth: 'thin', backgroundColor: '#0f172a' }}
        >
          {isCustomTyped && (
            <div
              onClick={() => handleSelect(searchQuery.trim())}
              className="px-3 py-2.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-b border-slate-700/60 cursor-pointer flex items-center justify-between font-semibold"
            >
              <div className="truncate">
                <span className="text-[11px] text-emerald-400 uppercase block">Defeito Personalizado:</span>
                <span>"{searchQuery.trim()}"</span>
              </div>
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shrink-0 ml-2">
                Usar este texto
              </span>
            </div>
          )}

          {filteredOptions.length === 0 && !isCustomTyped ? (
            <div className="px-3 py-3 text-center text-slate-400 text-xs italic">
              Nenhuma opção encontrada para "{searchQuery}"
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={opt.value + '_' + idx}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-600/30 text-emerald-200 font-bold'
                      : isHighlighted
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate">{opt.label}</div>
                    {opt.subtitle && (
                      <div className="text-[10px] text-slate-400 truncate">{opt.subtitle}</div>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-emerald-400 shrink-0 ml-1.5" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
