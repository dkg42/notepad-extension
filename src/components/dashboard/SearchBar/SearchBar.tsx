import React from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: SearchBarProps) {
  return (
    <div className={`search-bar ${className}`.trim()}>
      <input
        type="text"
        className="search-bar__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className="search-bar__icon-wrap">
        <AnimatePresence mode="popLayout" initial={false}>
          {value.length > 0 ? (
            <motion.button
              key="clear"
              className="search-bar__icon-btn"
              onClick={() => onChange('')}
              title="Clear search"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={14} strokeWidth={2.5} />
            </motion.button>
          ) : (
            <motion.span
              key="search"
              className="search-bar__icon-indicator"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Search size={14} strokeWidth={1.75} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
