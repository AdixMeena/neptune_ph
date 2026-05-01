import { useEffect, useRef, useState } from 'react'
import CLOUDS from 'vanta/dist/vanta.clouds.min'
import * as THREE from 'three'

export default function VantaBg() {
  const vantaRef = useRef(null)
  const [vantaEffect, setVantaEffect] = useState(null)

  useEffect(() => {
    if (!vantaEffect) {
      setVantaEffect(CLOUDS({
        el: vantaRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        backgroundColor: 0x23153c,
        skyColor: 0x68b8d7,
        cloudColor: 0xadc1de,
        cloudShadowColor: 0x183550,
        sunColor: 0xff9919,
        sunGlareColor: 0xff6633,
        sunlightColor: 0xff9933,
        speed: 1.0,
      }))
    }
    return () => { if (vantaEffect) vantaEffect.destroy() }
  }, [vantaEffect])

  return <div ref={vantaRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }} />
}
