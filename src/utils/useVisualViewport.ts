import { useState, useEffect } from 'react';

/**
 * Hook to track visual viewport height dynamically on mobile devices.
 * When the soft keyboard opens or closes, window.visualViewport height updates.
 */
export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return typeof window !== 'undefined' ? window.innerHeight : null;
  });

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height;
        setViewportHeight(currentHeight);

        // Typical software keyboard occupies at least 150px
        const screenHeight = window.screen.height || window.innerHeight;
        const keyboardOpen = screenHeight - currentHeight > 150;
        setIsKeyboardVisible(keyboardOpen);

        // Keep active input visible above keyboard
        const activeElement = document.activeElement;
        if (
          activeElement && 
          (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')
        ) {
          setTimeout(() => {
            activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 60);
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return { viewportHeight, isKeyboardVisible };
}
