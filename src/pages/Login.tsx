import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isBootstrapping } = useApp();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isBootstrapping) return null;
  if (isAuthenticated) return null;

  const handleLogin = () => {
    login();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <div className="absolute inset-0 soft-grid opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,129,247,0.2),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(63,185,80,0.12),transparent_25%)]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="card-shadow rounded-2xl border border-[var(--border-default)] bg-[color:rgb(22_27_34_/_92%)] backdrop-blur-md p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-muted)] border border-[color:rgb(56_139_253_/_35%)] mb-4">
                <Play size={30} className="text-[var(--accent-primary)]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-primary)] mb-2">
                Welcome to ActHub
              </h1>
              <p className="text-sm md:text-base text-[var(--text-secondary)]">
                Run and manage your CI/CD pipelines locally
              </p>
            </div>

            <Button onClick={handleLogin} className="w-full h-12 text-sm" size="lg">
              <svg className="w-[18px] h-[18px] mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Continue with GitHub
            </Button>

            <div className="mt-6 rounded-xl border border-[var(--border-muted)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-[var(--accent-primary)]" />
              GitHub credentials stay under your local control.
            </div>
          </div>

          <p className="text-center mt-6 text-xs text-[var(--text-tertiary)]">
            Powered by <span className="text-[var(--accent-primary)] font-medium">act</span>
          </p>
        </div>
      </div>
    </div>
  );
}
