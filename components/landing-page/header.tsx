import { Button } from "../ui/button";

const Header = () => {
  return (
    <header className="flex items-center justify-between border-b mb-16 border-[#131313] py-[17.5px] px-8 w-full">
      <h1 className="text-[20px]/[28px] font-bold">FlareWatch 🔥</h1>
      <ul className="flex items-center gap-8">
        <li className="text-[11px]/[16.5px] text-[#737373] font-medium">
          LIVE MAP
        </li>
        <li className="text-[11px]/[16.5px] text-[#737373] font-medium">
          ANALYTICS
        </li>
        <li className="text-[11px]/[16.5px] text-[#737373] font-medium">
          IMPACT
        </li>
        <li className="text-[11px]/[16.5px] text-[#737373] font-medium">
          ABOUT
        </li>
      </ul>
      <Button className="text-[11px]/[16.5px] font-bold px-4 py-2 bg-[#FF6B00] text-[#572000] rounded-none">
        CALCULATOR
      </Button>
    </header>
  );
};

export default Header;
