import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-96 lg:col-span-6" />
        <Skeleton className="h-96 lg:col-span-6" />
      </div>
    </div>
  );
}
