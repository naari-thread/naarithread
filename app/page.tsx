import { LandingPage } from "@/app/components/landing-page";
import { SmoothScrollProvider } from "@/app/components/smooth-scroll-provider";

export const revalidate = 86400; // hero content is static — revalidate once daily

export default function Home() {
  return (
    <SmoothScrollProvider>
      <LandingPage />
    </SmoothScrollProvider>
  );
}
