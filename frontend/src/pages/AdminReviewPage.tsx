// frontend/src/pages/AdminReviewPage.tsx
import { Routes, Route } from "react-router-dom";
import { ReviewQueueList } from "../components/ReviewQueueList";
import { ReviewDetailPage } from "../components/ReviewDetailPage";

export function AdminReviewPage() {
  return (
    <Routes>
      <Route path="/" element={<ReviewQueueList />} />
      <Route path="/:itemId" element={<ReviewDetailPage />} />
    </Routes>
  );
}
