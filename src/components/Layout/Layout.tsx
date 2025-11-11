import React, { Dispatch, SetStateAction } from 'react';

type NavItem = {
  key: string;
  label: string;
  icon: string;
};

type ServerStatus = {
  state: 'checking' | 'ready' | 'error';
  message: string;
};

type Config = {
  clientId: string;
  apiKey: string;
  spreadsheetId: string;
  sheetName: string;
};

type LayoutProps = {
  navItems: NavItem[];
  activeNavKey: string;
  onSelectNav: (key: string) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  serverStatus: ServerStatus;
  notice: string | null;
  onDismissNotice: () => void;
  error: string | null;
  onDismissError: () => void;
  showConfig: boolean;
  onToggleConfig: () => void;
  config: Config;
  setConfig: Dispatch<SetStateAction<Config>>;
  saveConfig: () => void;
  isAuthenticated: boolean;
  handleAuthenticate: () => void;
  loading: boolean;
  onStartNewShift: () => void;
  children: React.ReactNode;
};

const SidebarNav: React.FC<{
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}> = ({ items, activeKey, onSelect, collapsed = false, onToggle }) => {
  if (!items?.length) return null;
  const widthClass = collapsed ? 'lg:w-20' : 'lg:w-64';
  const headerPadding = collapsed ? 'px-4' : 'px-6';
  const navPadding = collapsed ? 'px-2' : 'px-4';
  return (
    <aside
      className={`hidden lg:flex ${widthClass} flex-col bg-slate-950/80 border-r border-slate-800/60 transition-all duration-300`}
    >
      <div
        className={`${headerPadding} py-6 border-b border-slate-800/60 flex items-center justify-between gap-3`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'} transition-all duration-300`}>
          <div className="bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-3 rounded-xl text-white text-2xl">
            <i className="fas fa-coins"></i>
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Bar Tracker</p>
              <h2 className="text-xl font-semibold text-slate-100">Tracker</h2>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggle && onToggle()}
          className="text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900 border border-slate-700 rounded-lg p-2 transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <i className={`fas ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
        </button>
      </div>
      <nav className={`flex-1 ${navPadding} py-6 space-y-2 overflow-y-auto`}>
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              title={item.label}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-0' : 'justify-start px-4 gap-3'
              } py-3 rounded-xl text-sm transition ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/70 via-fuchsia-500/60 to-fuchsia-500/80 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon}`}></i>
              <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

const MobileNav: React.FC<{
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}> = ({ items, activeKey, onSelect }) => {
  if (!items?.length) return null;
  return (
    <div className="lg:hidden px-4 pt-4">
      <div className="glass rounded-2xl border border-slate-800/40 p-4 shadow-lg shadow-slate-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-100">
            <div className="bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-2 rounded-lg text-white">
              <i className="fas fa-coins"></i>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Bar Tracker</p>
              <p className="font-semibold">Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium tracking-wide transition ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-900/70 text-slate-300 border border-slate-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigPanel: React.FC<{
  config: Config;
  setConfig: (config: Config) => void;
  saveConfig: () => void;
  isAuthenticated: boolean;
  handleAuthenticate: () => void;
  loading: boolean;
}> = ({ config, setConfig, saveConfig, isAuthenticated, handleAuthenticate, loading }) => (
  <div className="glass rounded-2xl shadow-xl p-6 mb-6 animate-slide-in border border-slate-800/40">
    <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
      <i className="fas fa-cog text-cyan-300"></i>
      Configuration
    </h2>

    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Google Client ID</label>
        <input
          type="text"
          value={config.clientId}
          onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
          className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
          placeholder="Your Google OAuth Client ID"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Google API Key</label>
        <input
          type="text"
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
          placeholder="Your Google API Key"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Spreadsheet ID</label>
        <input
          type="text"
          value={config.spreadsheetId}
          onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
          className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
          placeholder="Google Sheets ID from URL"
        />
        <p className="text-xs text-slate-500 mt-1">
          Found in the URL: docs.google.com/spreadsheets/d/<span className="font-mono">SPREADSHEET_ID</span>/edit
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Sheet Name</label>
        <input
          type="text"
          value={config.sheetName}
          onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
          className="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-100"
          placeholder="Shifts"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={saveConfig}
          className="flex-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300"
        >
          Save Configuration
        </button>
        {!isAuthenticated && config.clientId && config.apiKey && (
          <button
            onClick={handleAuthenticate}
            disabled={loading}
            className="flex-1 bg-emerald-500 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-600 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Authenticate'}
          </button>
        )}
      </div>

      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 mt-4">
        <h3 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle text-cyan-300"></i>
          Setup Instructions
        </h3>
        <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
          <li>Create a Google Cloud Project</li>
          <li>Enable Google Sheets API</li>
          <li>Create OAuth 2.0 credentials (Web application)</li>
          <li>Add authorized JavaScript origin: your domain</li>
          <li>Create an API Key with Sheets API access</li>
          <li>Create a Google Sheet with columns: ID, JSON Data</li>
          <li>Copy the Spreadsheet ID from the URL</li>
        </ol>
      </div>
    </div>
  </div>
);

const Layout: React.FC<LayoutProps> = ({
  navItems,
  activeNavKey,
  onSelectNav,
  sidebarCollapsed,
  onToggleSidebar,
  serverStatus,
  notice,
  onDismissNotice,
  error,
  onDismissError,
  showConfig,
  onToggleConfig,
  config,
  setConfig,
  saveConfig,
  isAuthenticated,
  handleAuthenticate,
  loading,
  onStartNewShift,
  children,
}) => (
  <div className="min-h-screen flex">
    <SidebarNav
      items={navItems}
      activeKey={activeNavKey}
      onSelect={onSelectNav}
      collapsed={sidebarCollapsed}
      onToggle={onToggleSidebar}
    />
    <div className="flex-1 flex flex-col">
      <MobileNav items={navItems} activeKey={activeNavKey} onSelect={onSelectNav} />
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="glass rounded-2xl shadow-xl p-6 mb-6 animate-slide-in border border-slate-800/40">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-3 rounded-xl text-white text-2xl">
                  <i className="fas fa-coins"></i>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-100">Bar Tracker</h1>
                  <p className="text-slate-400 text-sm">Track your shifts, tips, and earnings</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAuthenticated && (
                  <button
                    onClick={onStartNewShift}
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 flex items-center gap-2"
                  >
                    <i className="fas fa-plus"></i>
                    New Shift
                  </button>
                )}
                <button
                  onClick={onToggleConfig}
                  className="bg-slate-900/70 text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-300 border border-slate-700"
                >
                  <i className="fas fa-cog"></i>
                </button>
              </div>
            </div>
          </header>

          {serverStatus.state !== 'ready' && (
            <div
              className={`glass rounded-xl shadow-lg p-4 mb-6 border ${
                serverStatus.state === 'error'
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-cyan-500/40 bg-cyan-500/10'
              } animate-slide-in`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`text-xl ${
                    serverStatus.state === 'error'
                      ? 'text-red-300'
                      : 'text-cyan-300'
                  }`}
                >
                  <i
                    className={`fas ${
                      serverStatus.state === 'error'
                        ? 'fa-exclamation-triangle'
                        : 'fa-rocket'
                    }`}
                  ></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-100">
                    {serverStatus.state === 'error'
                      ? 'Server Not Ready'
                      : 'Starting Local Server'}
                  </p>
                  <p className="text-sm text-slate-300 mt-1">{serverStatus.message}</p>
                </div>
              </div>
            </div>
          )}

          {notice && (
            <div className="glass rounded-xl p-4 mb-6 border border-cyan-500/30 bg-cyan-500/10 animate-slide-in">
              <div className="flex items-center gap-3">
                <i className="fas fa-info-circle text-cyan-300 text-xl"></i>
                <div className="flex-1">
                  <p className="text-cyan-200 font-medium">Heads Up</p>
                  <p className="text-cyan-200/90 text-sm">{notice}</p>
                </div>
                <button onClick={onDismissNotice} className="text-cyan-300 hover:text-cyan-100">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="glass rounded-xl p-4 mb-6 border border-red-500/30 bg-red-500/10 animate-slide-in">
              <div className="flex items-center gap-3">
                <i className="fas fa-exclamation-triangle text-red-300 text-xl"></i>
                <div className="flex-1">
                  <p className="text-red-200 font-medium">Error</p>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
                <button onClick={onDismissError} className="text-red-300 hover:text-red-100">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          )}

          {showConfig && (
            <ConfigPanel
              config={config}
              setConfig={setConfig}
              saveConfig={saveConfig}
              isAuthenticated={isAuthenticated}
              handleAuthenticate={handleAuthenticate}
              loading={loading}
            />
          )}

          {children}
        </div>
      </main>
    </div>
  </div>
);

export default Layout;
