import { Home, Search, ShieldCheck, BarChart3 } from 'lucide-react'

const TABS = [
  { key: 'home', label: 'Inicio', icon: Home, path: '/' },
  { key: 'search', label: 'Buscar', icon: Search, path: null },
  { key: 'factcheck', label: 'Verificar', icon: ShieldCheck, path: '/verificaciones' },
  { key: 'consumption', label: 'Mi Consumo', icon: BarChart3, path: '/mi-consumo' },
]

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-[9990] glass-strong border-t border-border"
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch h-16">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                size={22}
                className={`transition-transform ${isActive ? 'scale-110' : ''}`}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-accent' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>
      {/* iOS safe area */}
      <div className="bottom-nav-safe" />
    </nav>
  )
}
