import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-96 lg:col-span-8" />
        <div className="space-y-6 lg:col-span-4">
          <Skeleton className="h-60" />
          <Skeleton className="h-36" />
        </div>
      </div>
    </div>
  );
}
