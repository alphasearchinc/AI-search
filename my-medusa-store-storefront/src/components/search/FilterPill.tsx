// Filter Pill component (for mobile filters)

interface FilterPillProps {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}

export const FilterPill = ({
  label,
  count,
  selected,
  onClick,
}: FilterPillProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
      selected
        ? "bg-ui-fg-base text-ui-bg-base"
        : "bg-ui-bg-subtle text-ui-fg-base hover:bg-ui-bg-subtle-hover"
    }`}
  >
    {label}
    <span className={selected ? "text-ui-bg-base/70" : "text-ui-fg-muted"}>
      ({count})
    </span>
  </button>
)
