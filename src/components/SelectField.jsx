import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "__all__"

// A shadcn Select that works like a native <select value onChange>.
// options = [{ value, label }]. allLabel adds a first "" option (for filters).
function SelectField({ value, onChange, options, allLabel, placeholder, disabled, className = "w-full" }) {
  const items = [
    ...(allLabel ? [{ value: ALL, label: allLabel }] : []),
    ...options,
  ]
  const current = allLabel && value === "" ? ALL : value

  return (
    <Select
      value={current === "" ? null : current}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// shortcut for lists of plain strings
// eslint-disable-next-line react-refresh/only-export-components
export const toOptions = (list) => list.map((v) => ({ value: v, label: v }))

export default SelectField
