"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

const Header = () => {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <header className="flex items-center justify-between border-b mb-16 border-[#131313] py-[17.5px] px-8 w-full">
      <Link href="/">
        <h1 className="text-[20px]/[28px] font-bold cursor-pointer">FlareWatch 🔥</h1>
      </Link>
      <ul className="flex items-center gap-8">
        <li>
          <Link href="/live-map">
            <span className={`text-[11px]/[16.5px] font-medium cursor-pointer transition-colors ${
              isActive("/live-map") ? "text-[#FF6B00]" : "text-[#737373] hover:text-[#A3A3A3]"
            }`}>
              LIVE MAP
            </span>
          </Link>
        </li>
        <li>
          <Link href="/calculator">
            <span className={`text-[11px]/[16.5px] font-medium cursor-pointer transition-colors ${
              isActive("/calculator") ? "text-[#FF6B00]" : "text-[#737373] hover:text-[#A3A3A3]"
            }`}>
              ANALYTICS
            </span>
          </Link>
        </li>
        <li className="text-[11px]/[16.5px] text-[#737373] font-medium">
          IMPACT
        </li>
        <li className="text-[11px]/[16.5px] text-[#737373] font-medium">
          ABOUT
        </li>
      </ul>
      <Link href="/calculator">
        <Button className="text-[11px]/[16.5px] font-bold px-4 py-2 bg-[#FF6B00] text-[#572000] rounded-none cursor-pointer">
          CALCULATOR
        </Button>
      </Link>
    </header>
  );
};

export default Header;
