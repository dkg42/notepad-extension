/**
 * @module FavoriteButton
 * @description Small toggle button that renders a filled or outline star icon to mark or unmark a prompt as a favorite.
 * @dependencies (none from src/ — stateless presentational component)
 * @public FavoriteButton
 */
import React from 'react';
import './FavoriteButton.css';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

export default function FavoriteButton({ isFavorite, onToggle }: FavoriteButtonProps) {
  return (
    <button
      className={`favorite-btn${isFavorite ? ' favorite-btn--active' : ''}`}
      onClick={onToggle}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}
