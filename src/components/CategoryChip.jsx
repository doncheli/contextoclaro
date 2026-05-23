/**
 * Chip pill estilo Stitch para filtros de categoría.
 * Soporta variantes:
 *   - default (gris activo / accent inactivo)
 *   - danger (para "Fake News")
 */
export default function CategoryChip({ label, icon, active = false, onClick, variant = 'default' }) {
  const base = 'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 duration-150'

  let classes
  if (variant === 'danger') {
    classes = active
      ? 'bg-danger text-white border border-danger'
      : 'bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20'
  } else if (active) {
    classes = 'bg-accent text-white border border-accent'
  } else {
    classes = 'bg-card hover:bg-card-hover border border-border text-text-secondary'
  }

  return (
    <button
      onClick={onClick}
      className={`${base} ${classes}`}
      aria-pressed={active}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </button>
  )
}

export function CategoryChipRow({ chips = [], activeKey, onSelect }) {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
      <div className="flex items-center gap-2 min-w-max">
        {chips.map(chip => (
          <CategoryChip
            key={chip.key}
            label={chip.label}
            icon={chip.icon}
            active={activeKey === chip.key}
            onClick={() => onSelect?.(chip.key)}
            variant={chip.variant}
          />
        ))}
      </div>
    </div>
  )
}
