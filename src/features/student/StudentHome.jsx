import { lazy, Suspense } from 'react';
import { useDesign } from '../../lib/useDesign';
import { SkeletonText, SkeletonCard, SkeletonList } from '../../components/Skeleton';
import LessonRating from '../../components/LessonRating';

// The home screen of the design the student has chosen. Only the one actually shown is downloaded.
const CockpitHome = lazy(() => import('./CockpitHome'));
const BaseHome = lazy(() => import('./BaseHome'));
const ConsoleHome = lazy(() => import('./ConsoleHome'));
const HOMES = { cockpit: CockpitHome, base: BaseHome, console: ConsoleHome };

const HomeSkeleton = () => (
  <div className="space-y-6">
    <SkeletonText width="14rem" height="1.6rem" />
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <SkeletonCard lines={3} />
      <SkeletonList rows={3} />
    </div>
  </div>
);

const StudentHome = () => {
  const Home = HOMES[useDesign()];
  return (
    <>
      <LessonRating />
      <Suspense fallback={<HomeSkeleton />}>
        <Home />
      </Suspense>
    </>
  );
};

export default StudentHome;
