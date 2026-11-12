export default function WellbeingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-14 w-64 rounded-2xl bg-surface-elevated" />
      <div className="h-20 rounded-2xl bg-surface-elevated" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="h-64 rounded-2xl bg-surface-elevated lg:col-span-5" />
        <div className="h-64 rounded-2xl bg-surface-elevated lg:col-span-7" />
      </div>
      <div className="h-72 rounded-2xl bg-surface-elevated" />
    </div>
  );
}
