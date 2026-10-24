import EmergencyTicker from '@/components/landing/EmergencyTicker';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import MetricsStrip from '@/components/landing/MetricsStrip';
import HowItWorks from '@/components/landing/HowItWorks';
import FleetTypes from '@/components/landing/FleetTypes';
import HospitalNetwork from '@/components/landing/HospitalNetwork';
import EmergencyBanner from '@/components/landing/EmergencyBanner';
import Footer from '@/components/landing/Footer';

/**
 * View: Public Landing Page
 */
export default function LandingView() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-zinc-950 text-white">
      <EmergencyTicker />
      <LandingHeader />
      <main className="w-full flex flex-col flex-1">
        <HeroSection />
        <MetricsStrip />
        <HowItWorks />
        <FleetTypes />
        <HospitalNetwork />
        <EmergencyBanner />
      </main>
      <Footer />
    </div>
  );
}

