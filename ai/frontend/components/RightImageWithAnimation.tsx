"use client";

import AnimatedImageLogo from "./AnimatedImageLogo";

export default function RightImageWithAnimation() {
  return (
    <div className="relative right-image-container w-full h-full flex justify-center items-center">
      <AnimatedImageLogo size="large" showText={false} />
    </div>
  );
}
