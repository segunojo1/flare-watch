import { sectionTwoData } from "@/lib/data"

const SectionTwo = () => {
  return (
    <section className="flex items-center justify-between border-y border-[#5A4136] ">
        {sectionTwoData.map(item => (
            <SectionCard key={item.no} no={item.no} title={item.title} text={item.text} />
        ))}
    </section>
  )
}

export default SectionTwo

interface SectionCardProps {
    no: string;
    title: string;
    text: string;
}

export const SectionCard = ({no, title, text}: SectionCardProps) => {
  return (
    <div className="flex flex-col gap-4 items-center p-10">
        <h3 className="text-[10px]/[15px] font-normal text-[#ff6b00] tracking-[1px]">{no}</h3>
        <h4 className="text-[24px]/[32px] font-normal">{title}</h4>
        <p className="text-[14px]/[28px] font-normal text-[#C6C6C7]">{text}</p>
    </div>
  )
}
