// Filter Checkbox component

interface FilterCheckboxProps {
  label: string
  count: number
  checked: boolean
  onChange: () => void
}

export const FilterCheckbox = ({
  label,
  count,
  checked,
  onChange,
}: FilterCheckboxProps) => (
  <label className="flex items-center gap-2 py-1 cursor-pointer group">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="w-4 h-4 rounded border-ui-border-base text-ui-fg-base focus:ring-ui-fg-base focus:ring-offset-0"
    />
    <span className="flex-1 text-sm text-ui-fg-base group-hover:text-ui-fg-base/80 truncate">
      {label}
    </span>
    <span data-testid="facet-count" className="text-xs text-ui-fg-muted">
      {count}
    </span>
  </label>
)
