import { Bell, Search, Command } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
}

export default function Header({ title, subtitle, actions, showSearch = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[color:rgb(13_17_23_/_85%)] backdrop-blur-md border-b border-[var(--border-default)]">
      <div className="flex items-center justify-between min-h-[var(--header-height)] px-4 md:px-6 py-3 gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-[var(--text-secondary)] truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {showSearch && (
            <div className="relative hidden lg:block w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
              <Input
                type="text"
                placeholder="Search repositories or workflow files"
                className="pl-10 pr-14 bg-[var(--bg-secondary)]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                <Command size={12} />
                K
              </span>
            </div>
          )}

          <div className="relative">
            <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
              <Bell size={20} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--accent-primary)] rounded-full text-[10px] text-white flex items-center justify-center">
                2
              </span>
            </Button>
          </div>

          {actions}
        </div>
      </div>
    </header>
  );
}
