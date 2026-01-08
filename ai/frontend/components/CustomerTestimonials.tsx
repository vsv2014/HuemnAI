"use client";

import { useState } from "react";

const testimonials = [
  {
    company: "Morgan Stanley",
    quote: "HUMANE.OS helped our financial advisors save 15-20 minutes daily, enabling them to engage with customers more effectively and drive revenue.",
  },
  {
    company: "Pfizer",
    quote: "We've deployed 60 AI agents across various enterprise functions—research, development, medical, commercial, manufacturing—globally. We needed a scalable platform, and the agents are getting increasingly intelligent.",
  },
  {
    company: "Microsoft",
    quote: "Our strategic partnership with HUMANE.OS marks a milestone in accelerating enterprise AI transformation, integrating conversational and Gen AI capabilities with our cloud for scalable and secure AI adoption.",
  },
  {
    company: "Amazon",
    quote: "HUMANE.OS has transformed how we handle customer service at scale. The AI agents provide consistent, high-quality support 24/7, significantly improving our customer satisfaction scores.",
  },
  {
    company: "Goldman Sachs",
    quote: "The platform's ability to understand complex financial queries and provide accurate responses has been a game-changer for our operations team.",
  },
  {
    company: "JPMorgan Chase",
    quote: "Implementing HUMANE.OS across our customer service channels has reduced response times by 70% while maintaining the highest quality standards.",
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
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20 bg-white/5 rounded-2xl border border-white/10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12">
        <div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Customer testimonials
          </h2>
          <p className="text-lg sm:text-xl text-white/70">
            Discover how organizations deliver AI value with HUMANE.OS.
          </p>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={prevTestimonial}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-all"
            aria-label="Previous testimonial"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextTestimonial}
            className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
            aria-label="Next testimonial"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Testimonials Carousel */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="min-w-full px-2"
            >
              <div className="bg-white/5 rounded-xl border border-white/10 p-6 sm:p-8 md:p-10">
                <h3 className="text-xl sm:text-2xl font-bold mb-4 text-white">
                  {testimonial.company}
                </h3>
                <p className="text-base sm:text-lg text-white/80 leading-relaxed">
                  "{testimonial.quote}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-6 sm:mt-8">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? "bg-white w-8" : "bg-white/30"
            }`}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>

      {/* More Customer Stories Button */}
      <div className="mt-8 sm:mt-10">
        <button className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 border border-white/20 rounded-lg text-white font-semibold hover:bg-white/20 transition-all flex items-center gap-2">
          MORE CUSTOMER STORIES
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

