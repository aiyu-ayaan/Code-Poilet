import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  Workflow,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Play
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../ui/Button';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/repositories', icon: GitBranch, label: 'Repositories' },
  { path: '/pipelines', icon: Workflow, label: 'Pipelines' },
  { path: '/runs', icon: Play, label: 'Runs History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside
      className={`sticky top-0 h-screen bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex flex-col transition-all duration-300 z-40 ${isCollapsed ? 'w-20' : 'w-[var(--sidebar-width)]'
        }`}
    >
      <div className="flex items-center justify-between px-4 h-[var(--header-height)] border-b border-[var(--border-muted)]">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
              <Play size={18} className="text-white" />
            </div>
            <span className="font-semibold text-[var(--text-primary)]">ActHub</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  } ${isCollapsed ? 'justify-center' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon size={20} />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-[var(--border-muted)]">
        {user && (
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full border border-[var(--border-default)]"
            />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
              </div>
            )}
            {!isCollapsed && (
              <Button variant="ghost" size="sm" onClick={handleLogout} className="p-1.5" title="Logout">
                <LogOut size={16} />
              </Button>
            )}
          </div>
        )}
        {isCollapsed && (
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-center p-1.5 mt-2" title="Logout">
            <LogOut size={18} />
          </Button>
        )}
      </div>
    </aside>
  );
}
