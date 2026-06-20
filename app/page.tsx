import { LandingPage } from "@/app/components/landing-page";
import { SmoothScrollProvider } from "@/app/components/smooth-scroll-provider";
import { getActiveBanners } from "@/lib/appwrite/banners";

export const revalidate = 86400;

export default async function Home(): Promise<React.ReactElement> {
  const banners = await getActiveBanners();

  return (
    <SmoothScrollProvider>
      <LandingPage banners={banners} />
    </SmoothScrollProvider>
  );
}
