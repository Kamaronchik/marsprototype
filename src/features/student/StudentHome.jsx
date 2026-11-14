import { Suspense, lazy } from 'react';
import { SkeletonText, SkeletonCard, SkeletonList } from '../../components/Skeleton';
import LessonRating from '../../components/LessonRating';

// The home screen is downloaded only when the student opens it.
const BaseHome = lazy(() => import('./BaseHome'));

const HomeSkeleton = () => (
  <div className="space-y-6">
    <SkeletonText width="14rem" height="1.6rem" />
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <SkeletonCard lines={3} />
      <SkeletonList rows={3} />
    </div>
  </div>
);

const StudentHome = () => (
  <>
    <LessonRating />
    <Suspense fallback={<HomeSkeleton />}>
      <BaseHome />
    </Suspense>
  </>
);

export default StudentHome;
