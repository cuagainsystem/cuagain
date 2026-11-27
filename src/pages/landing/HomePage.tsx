import { ClaimingSection } from './ClaimingSection';
import { FaqSection } from './FaqSection';
import { FinalCta } from './FinalCta';
import { GuidelinesSection } from './GuidelinesSection';
import { HeroSection } from './HeroSection';
import { ProcessSection } from './ProcessSection';
import { PurposeSection } from './PurposeSection';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <PurposeSection />
      <ProcessSection />
      <GuidelinesSection />
      <ClaimingSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
