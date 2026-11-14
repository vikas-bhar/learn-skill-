import React from 'react';

interface SkillPathLogoProps {
  className?: string;
}

export const SkillPathLogo: React.FC<SkillPathLogoProps> = ({ className = '' }) => {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] flex items-center justify-center shadow-sm shadow-[#6D5DFB]/30 shrink-0">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 17C7.5 17 8.5 7 12 7C15.5 7 16.5 14 20 14"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="4" cy="17" r="2.2" fill="#FFFFFF" />
          <circle cx="12" cy="7" r="2.2" fill="#FFFFFF" />
          <circle cx="20" cy="14" r="2.2" fill="#34D399" />
        </svg>
      </span>
      <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
        SkillPath AI
      </span>
    </span>
  );
};
