import React from 'react'

const Hero = () => {
  return (
    <div className='flex items-center '>
        <h1 className='text-[96px]/[96px] newsreader-font font-normal -tracking-[2.4px] '>
            FlareWatch exists because <span className='text-[#FF6B00] italic'>data</span> makes injustice visible.
        </h1>

        <div>
            <p className='text-[18px]/[29.3px] text-[#C6C6C7] border-l border-[#5A4136] pl-8 '>We bridge the gap between orbital intelligence and environmental accountability. By translating satellite heat signatures into localized impact data, we empower communities to challenge unregulated gas flaring.</p>
            <p className='text-[12px]/[16px] font-bold text-[#A98A7D] mt-12'>DATA SOVEREIGNTY PARTNERS</p>
        </div>
    </div>
  )
}

export default Hero