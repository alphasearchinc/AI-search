interface FilterSectionProps {
  title: string
  count?: number
  children: React.ReactNode
}

export const FilterSection = ({
  title,
  count,
  children,
}: FilterSectionProps) => (
  <div className="border-b border-ui-border-base pb-5 last:border-b-0">
    <h3 className="text-sm font-medium text-ui-fg-base mb-3 flex items-center justify-between">
      <span>{title}</span>
      {count !== undefined && count > 6 && (
        <span className="text-xs text-ui-fg-muted font-normal">
          {count} options
        </span>
      )}
    </h3>
    {children}
  </div>
)
