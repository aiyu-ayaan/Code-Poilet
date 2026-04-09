import { useApp } from '../context/AppContext';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';

export default function Settings() {
  const { user } = useApp();

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Settings" />

      <main className="flex-1 p-6">
        <div className="max-w-2xl space-y-6">
          {/* Profile Section */}
          <Card>
            <div className="p-4 border-b border-[var(--border-muted)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Profile</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Manage your account information
              </p>
            </div>
            <div className="p-4 space-y-4">
              {user && (
                <div className="flex items-center gap-4">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-16 h-16 rounded-full border border-[var(--border-default)]"
                  />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{user.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* General Settings */}
          <Card>
            <div className="p-4 border-b border-[var(--border-muted)]">
              <h3 className="font-semibold text-[var(--text-primary)]">General</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Configure general application settings
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Notifications</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Receive notifications about pipeline runs
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-muted)]">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Auto-run on push</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Automatically trigger pipelines on git push
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                </label>
              </div>
            </div>
          </Card>

          {/* About */}
          <Card>
            <div className="p-4 border-b border-[var(--border-muted)]">
              <h3 className="font-semibold text-[var(--text-primary)]">About</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Application information
              </p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-secondary)]">Version</p>
                  <p className="text-[var(--text-primary)] font-medium">1.0.0</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Act Version</p>
                  <p className="text-[var(--text-primary)] font-medium">0.2.50</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">License</p>
                  <p className="text-[var(--text-primary)] font-medium">MIT</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
