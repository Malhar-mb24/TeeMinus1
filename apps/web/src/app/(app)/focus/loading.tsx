import { Skeleton } from "@/components/ui/skeleton";

export default function FocusLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[460px] lg:col-span-7" />
        <Skeleton className="h-[460px] lg:col-span-5" />
      </div>
    </div>
  );
}
