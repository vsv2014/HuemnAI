"use client";

import { useState } from "react";

const testimonials = [
  {
    company: "Morgan Stanley",
    quote: "HUEMN.Ai helped our financial advisors save 15-20 minutes daily, enabling them to engage with customers more effectively and drive revenue.",
  },
  {
    company: "Pfizer",
    quote: "We've deployed 60 AI agents across various enterprise functions—research, development, medical, commercial, manufacturing—globally. We needed a scalable platform, and the agents are getting increasingly intelligent.",
  },
  {
    company: "Microsoft",
    quote: "Our strategic partnership with HUEMN.Ai marks a milestone in accelerating enterprise AI transformation, integrating conversational and Gen AI capabilities with our cloud for scalable and secure AI adoption.",
  },
  {
    company: "Amazon",
    quote: "HUEMN.Ai has transformed how we handle customer service at scale. The AI agents provide consistent, high-quality support 24/7, significantly improving our customer satisfaction scores.",
  },
  {
    company: "Goldman Sachs",
    quote: "The platform's ability to understand complex financial queries and provide accurate responses has been a game-changer for our operations team.",
  },
  {
    company: "JPMorgan Chase",
    quote: "Implementing HUEMN.Ai across our customer service channels has reduced response times by 70% while maintaining the highest quality standards.",
  },
];

export default function CustomerTestimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-3xl rounded-3xl border-t border-l border-white/20 border-b-white/5 border-r-white/5 shadow-[0_8px_32px_0_rgba(31,38,135,0.37),inset_0_0_0_1px_rgba(255,255,255,0.1)] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 rounded-3xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3" />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12 relative z-10">
        <div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-indigo-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            Customer testimonials
          </h2>
          <p className="text-lg sm:text-xl text-white/70">
            Discover how organizations deliver AI value with HUEMN.Ai.
          </p>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={prevTestimonial}
            className="w-12 h-12 rounded-full border border-t-white/30 border-l-white/20 border-r-white/10 border-b-white/10 flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            aria-label="Previous testimonial"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextTestimonial}
            className="w-12 h-12 rounded-full bg-white/5 border border-t-white/30 border-l-white/20 border-r-white/10 border-b-white/10 flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            aria-label="Next testimonial"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Testimonials Carousel */}
      <div className="relative overflow-hidden z-10">
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="min-w-full px-2"
            >
              <div className="bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl rounded-3xl border border-t-white/20 border-l-white/10 border-b-white/5 border-r-white/5 p-8 sm:p-10 md:p-12 hover:border-white/30 transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.05)] group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="mb-6 relative z-10">
                  <div className="inline-block p-3 rounded-2xl bg-white/5 border border-white/20 mb-4 shadow-inner">
                    <svg className="w-8 h-8 text-blue-300 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 7.55228 14.017 7V3H19.017C20.6739 3 22.017 4.34315 22.017 6V15C22.017 16.6569 20.6739 18 19.017 18H16.017V21H14.017ZM5.0166 21L5.0166 18C5.0166 16.8954 5.91203 16 7.0166 16H10.0166C10.5689 16 11.0166 15.5523 11.0166 15V9C11.0166 8.44772 10.5689 8 10.0166 8H6.0166C5.46432 8 5.0166 7.55228 5.0166 7V3H10.0166C11.6735 3 13.0166 4.34315 13.0166 6V15C13.0166 16.6569 11.6735 18 10.0166 18H7.0166V21H5.0166Z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-white tracking-tight group-hover:text-blue-100 transition-colors">
                    {testimonial.company}
                  </h3>
                </div>
                <p className="text-lg sm:text-2xl text-white/90 leading-relaxed font-light italic">
                  "{testimonial.quote}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-3 mt-8 sm:mt-10 z-10 relative">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all duration-500 ${
              index === currentIndex 
                ? "bg-white w-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                : "bg-white/20 w-2 hover:bg-white/40"
            }`}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>

      {/* More Customer Stories Button */}
      <div className="mt-10 sm:mt-12 text-center z-10 relative">
        <button className="px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-full text-white font-bold hover:bg-white/20 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] backdrop-blur-md flex items-center gap-3 mx-auto group">
          MORE CUSTOMER STORIES
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white group-hover:text-blue-900 transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    </section>
  );
}

