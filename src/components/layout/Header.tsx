import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Search, Command, CheckCheck, ExternalLink, Inbox, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
}

export default function Header({ title, subtitle, actions, showSearch = false }: HeaderProps) {
  const { notifications, unreadNotifications, markNotificationsRead, dismissNotification } = useApp();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isNotificationOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isNotificationOpen]);

  useEffect(() => {
    if (isNotificationOpen && unreadNotifications > 0) {
      markNotificationsRead();
    }
  }, [isNotificationOpen, markNotificationsRead, unreadNotifications]);

  const notificationSummary = useMemo(() => {
    if (notifications.length === 0) {
      return 'No recent activity';
    }

    return `${notifications.length} recent ${notifications.length === 1 ? 'update' : 'updates'}`;
  }, [notifications.length]);

  function formatTimestamp(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

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
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              aria-label="Notifications"
              aria-expanded={isNotificationOpen}
              onClick={() => setIsNotificationOpen((prev) => !prev)}
            >
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[var(--accent-primary)] rounded-full text-[10px] text-white flex items-center justify-center">
                  {Math.min(unreadNotifications, 9)}
                </span>
              )}
            </Button>

            {isNotificationOpen && (
              <div
                ref={panelRef}
                className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] card-shadow overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[var(--border-muted)] flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Notifications</p>
                    <p className="text-xs text-[var(--text-secondary)]">{notificationSummary}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={markNotificationsRead}>
                    <CheckCheck size={14} className="mr-1.5" />
                    Mark all read
                  </Button>
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
                      <Inbox size={18} className="text-[var(--text-tertiary)]" />
                    </div>
                    <p className="font-medium text-[var(--text-primary)]">No notifications yet</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Pipeline queue and run updates will land here live.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`px-4 py-3 border-b border-[var(--border-muted)] transition-colors ${
                          notification.isRead ? 'bg-transparent' : 'bg-[color:rgb(47_129_247_/_10%)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-[var(--text-primary)]">{notification.title}</p>
                              {!notification.isRead && <span className="status-dot bg-[var(--accent-primary)]" />}
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mt-1 break-words">{notification.message}</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-2">{formatTimestamp(notification.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {notification.href && (
                              <Link to={notification.href} onClick={() => setIsNotificationOpen(false)}>
                                <Button variant="ghost" size="sm" aria-label="Open notification target">
                                  <ExternalLink size={14} />
                                </Button>
                              </Link>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Dismiss notification"
                              onClick={() => dismissNotification(notification.id)}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {actions}
        </div>
      </div>
    </header>
  );
}
