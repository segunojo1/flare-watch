const Footer = () => {
  return (
    <footer className="px-10">
      <div className="flex justify-between mb-[230px] pt-12 ">
        <div className="p-12 bg-[#0E0E0E] flex flex-col items-start gap-6  max-w-[520px]">
          <p className="text-[10px]/[15px] tracking-[2px] ">
            OPEN SOURCE DISCLOSURE
          </p>
          <p className="text-[#C6C6C7] text-[12px]/[19.5px]">
            FlareWatch is an open-intelligence project. All methodologies are
            audited for scientific rigor. If you are a developer or
            environmental scientist interested in contributing to our thermal
            detection pipeline, visit our repository.
          </p>
        </div>

        <div className="p-12 flex flex-col items-start  max-w-[520px]">
          <p className="text-[10px]/[15px] tracking-[2px] mb-4 ">
            CONTACT INTELLIGENCE
          </p>
          <p className=" text-[12px]/[19.5px] text-[#A98A7D] mb-8">
            Direct inquiries regarding data licensing and institutional partnerships.
          </p>
          <p className="text-[12px]/[16px] text-[#FF6B00] underline">INTEL@FLAREWATCH.ORG</p>
        </div>
      </div>

      <div className="py-12 flex justify-between w-full items-center border-t border-[#5A4136]">
        <p className="text-[20px]/[28px] newsreader-font italic ">FlareWatch</p>
        <ul className="text-[10px]/[15px] text-[#525252] tracking-[1px] flex items-center gap-8">
            <li>METHODOLOGY</li>
            <li>NASA FIRMS</li>
            <li>WORLD BANK GDFR</li>
            <li>CONTACT</li>
        </ul>

        <div className="text-[#A98A7D] flex flex-col text-[10px]/[15px] items-end gap-2">
            <p>© 2024 FLAREWATCH. SATELLITE INTELLIGENCE FOR ENVIRONMENTAL JUSTICE.</p>
            <p>HACKATHON BUILD V1.0.2 // SENTINEL-2 INTEGRATION</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
