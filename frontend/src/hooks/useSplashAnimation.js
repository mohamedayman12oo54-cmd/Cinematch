import { useState, useEffect } from 'react';

export const useSplashAnimation = () => {
  const [scene, setScene] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timeline = [
      { delay: 600, scene: 1 },      // Scene 1: Black screen (opening)
      { delay: 800, scene: 2 },      // Scene 2: Light effect
      { delay: 600, scene: 3 },      // Scene 3: Movie icon
      { delay: 500, scene: 4 },      // Scene 4: Welcome text
      { delay: 1000, scene: 5 },     // Scene 5: Main logo
      { delay: 600, scene: 6 },      // Scene 6: Subtitle
      { delay: 500, scene: 7 },      // Scene 7: Divider
      { delay: 2000, scene: 8 },     // Scene 8: Final moment (2 seconds)
    ];

    let totalDelay = 0;
    const timeouts = [];

    timeline.forEach(({ delay, scene: targetScene }) => {
      totalDelay += delay;
      const timeout = setTimeout(() => {
        setScene(targetScene);
      }, totalDelay);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const handleExit = () => {
    setIsExiting(true);
  };

  return { scene, isExiting, handleExit };
};
