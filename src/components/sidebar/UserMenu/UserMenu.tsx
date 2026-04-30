import React from 'react';
import { User, Settings, LogOut } from 'lucide-react';
import type { StoredAuthProfile } from '@/types';
import './UserMenu.css';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(uid: string | null): string {
  if (!uid) return 'oklch(0.55 0.18 270)';
  const hues = [270, 160, 30, 320, 220, 75];
  const idx = uid.charCodeAt(0) % hues.length;
  return `oklch(0.55 0.18 ${hues[idx]})`;
}

interface UserMenuProps {
  user: StoredAuthProfile;
  onClose: () => void;
  onSignOut: () => void;
}

export default function UserMenu({ user, onClose, onSignOut }: UserMenuProps) {
  return (
    <>
      <div className="user-menu__backdrop" onClick={onClose} />
      <div className="user-menu__popover">
        <div className="user-menu__profile">
          <div
            className="user-menu__avatar"
            style={{ background: getAvatarColor(user.uid) }}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName ?? ''} />
            ) : (
              getInitials(user.displayName)
            )}
          </div>
          <div className="user-menu__profile-info">
            <div className="user-menu__name">{user.displayName ?? 'User'}</div>
            <div className="user-menu__email">{user.email ?? ''}</div>
          </div>
        </div>

        <div className="user-menu__section">
          <button className="user-menu__item">
            <User size={13} />
            <span className="user-menu__item-label">Account settings</span>
          </button>
          <button className="user-menu__item">
            <Settings size={13} />
            <span className="user-menu__item-label">Preferences</span>
          </button>
        </div>

        <div className="user-menu__section user-menu__section--bordered">
          <div className="user-menu__plan-row">
            <span className="user-menu__plan-label">Plan</span>
            <span className="user-menu__plan-badge">
              <span className="user-menu__plan-dot" />
              Free
            </span>
          </div>
        </div>

        <div className="user-menu__section user-menu__section--bordered">
          <button
            className="user-menu__item user-menu__item--danger"
            onClick={() => { onSignOut(); onClose(); }}
          >
            <LogOut size={13} />
            <span className="user-menu__item-label">Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}
