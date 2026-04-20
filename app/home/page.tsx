import Header from "@/components/landing-page/header";
import Hero from "@/components/landing-page/hero";
import SectionTwo from "@/components/landing-page/SectionTwo";

const Home = () => {
  return (
    <div className="px-24 max-w-7xl mx-auto">
      <Header />
      <Hero />
      <SectionTwo />
    </div>
  );
};

export default Home;
