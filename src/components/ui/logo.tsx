'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface LogoProps {
  type?: 'full' | 'icon';
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

export function Logo({ type = 'full', width, height, priority, className }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check if dark mode is active
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(isDarkMode);
    };

    checkDarkMode();

    // Listen for changes in dark mode
    const darkModeObserver = new MutationObserver(checkDarkMode);
    darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      darkModeObserver.disconnect();
      darkModeMediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  const logoSrc = type === 'full'
    ? (isDark ? '/provvypay-logo-dark.svg' : '/provvypay-logo.svg')
    : (isDark ? '/provvypay-icon-dark.svg' : '/provvypay-icon.svg');

  return (
    <Image
      src={logoSrc}
      alt="Provvypay"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
