type InfoRowProps = {
  label: string
  value: string
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between text-[0.75rem]">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  )
}

export default InfoRow
