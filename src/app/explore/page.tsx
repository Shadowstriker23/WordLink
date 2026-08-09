import { Suspense } from "react";
import ExploreClient from "./explore-client";

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreClient />
    </Suspense>
  );
}
