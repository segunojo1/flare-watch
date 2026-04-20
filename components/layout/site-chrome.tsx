"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";

type SiteChromeProps = {
  children: React.ReactNode;
};

const SiteChrome = ({ children }: SiteChromeProps) => {
  const pathname = usePathname();
  const shouldHideFooter = pathname.startsWith("/live-map");

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      {!shouldHideFooter ? <Footer /> : null}
    </>
  );
};

export default SiteChrome;
