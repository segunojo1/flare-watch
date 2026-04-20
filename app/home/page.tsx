import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

const Home = () => {
  return (
    <div className="flex items-center justify-center">
      <div className="relative flex items-center justify-center max-w-[800px] mb-[256px]">
        <Image
          src="/assets/globee.svg"
          alt="Live Map"
          width={800}
          height={600}
          className=""
        />

        <div className="flex flex-col gap-4 absolute justify-center items-center">
          <h1 className="z-[999] relative text-center text-[96px]/[96px] newsreader-font -tracking-[1.92px] italic">
            Nigeria is burning
            <span className="font-bold"> its future.</span>
          </h1>
          <p className="text-[#A3A3A3] text-[16px]/[24px] ">
            174 active flare sites. $1.05B lost in 2024. Tracked in real time
            from space.
          </p>

          <div className="flex gap-4 h-[88px] z-[999] relative my-12">
            <div className="bg-black items-center justify-center flex flex-col gap-1 py-[11px] px-6 pr-[49px] border border-white self-start">
              <p className="text-[#737373] text-[9.6px]/[14.4px] font-bold ">
                METHANE INT.
              </p>
              <p className="text-[20px]/[28px] italic ">4.2M Tons</p>
            </div>
            <div className="bg-black items-center justify-center flex flex-col gap-1 py-[11px] px-6 pr-[49px] border border-white  self-end">
              <p className="text-[#FF6B00] text-[9.6px]/[14.4px] font-bold ">
                LIVE FLARES
              </p>
              <p className="text-[20px]/[28px] italic ">174 Sites</p>
            </div>
            <div className="bg-black items-center justify-center flex flex-col gap-1 py-[11px] px-6 pr-[49px] border border-white self-start">
              <p className="text-[#737373] text-[9.6px]/[14.4px] font-bold ">
                CAPITAL LOSS
              </p>
              <p className="text-[20px]/[28px] italic ">$1.05B USD</p>
            </div>
          </div>
          <Link
            href="/live-map"
            className="bg-[#FF6B00] text-black hover:bg-[#FF6B00]/90 py-5 px-10 rounded-none h-full text-[12px]/[16px] font-bold"
          >
            EXPLORE LIVE MAP
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
