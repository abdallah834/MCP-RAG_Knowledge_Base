import { Outlet, NavLink } from 'react-router-dom';
import { MessageSquare, FileText, Database, Zap } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/chat',      label: 'Chat',      icon: MessageSquare },
  { to: '/documents', label: 'Documents', icon: FileText },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 glass flex flex-col py-6 px-3 gap-1">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 mb-6">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">KnowledgeBase</span>
        </div>

        {/* Nav */}
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}

        {/* Footer */}
        <div className="mt-auto px-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Zap className="w-3 h-3 text-brand-500" />
            RAG + MCP powered
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
