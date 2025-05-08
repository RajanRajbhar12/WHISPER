import { LandingHero } from "@/components/landing-hero"
import { LandingNavbar } from "@/components/landing-navbar"
import { LandingFeatures } from "@/components/landing-features"
import { LandingTestimonials } from "@/components/landing-testimonials"
import { LandingFooter } from "@/components/landing-footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/90">
      <LandingNavbar />
      <LandingHero />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingFooter />
    </div>
  )
}
