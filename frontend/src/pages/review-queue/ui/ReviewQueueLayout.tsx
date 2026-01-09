// frontend/src/pages/review-queue/ui/ReviewQueueLayout.tsx
import { ReactNode } from "react";

interface ReviewQueueLayoutProps {
  filters: ReactNode;
  list: ReactNode;
  panel: ReactNode;
}

export function ReviewQueueLayout({ filters, list, panel }: ReviewQueueLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      {/* Filters - Left Column */}
      <div className="lg:col-span-3">
        {filters}
      </div>
      
      {/* List - Middle Column */}
      <div className="lg:col-span-5">
        {list}
      </div>
      
      {/* Panel - Right Column */}
      <div className="lg:col-span-4">
        {panel}
      </div>
    </div>
  );
}
