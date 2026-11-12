"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="border-rose/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rose">
          <AlertCircle className="h-5 w-5" />
          Unable to load dashboard
        </CardTitle>
        <CardDescription>
          An unexpected error interrupted loading your workspace. Your account data
          remains safe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
