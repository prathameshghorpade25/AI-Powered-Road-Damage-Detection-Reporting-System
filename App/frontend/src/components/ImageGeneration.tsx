import * as React from "react";
import { motion } from "motion/react";

export interface ImageGenerationProps {
  children: React.ReactNode;
  isScanning?: boolean;
}

export const ImageGeneration = ({ children, isScanning = true }: ImageGenerationProps) => {
  const [progress, setProgress] = React.useState(0);
  const [loadingState, setLoadingState] = React.useState<
    "idle" | "starting" | "generating" | "completed"
  >(isScanning ? "starting" : "completed");
  const duration = 8000; // Adjusted for a faster scan feel, down from 30s

  React.useEffect(() => {
    if (!isScanning) {
      const timeout = setTimeout(() => {
        setLoadingState("completed");
        setProgress(100);
      }, 0);
      return () => clearTimeout(timeout);
    }

    const initialTimeout = setTimeout(() => {
      setLoadingState("starting");
      setProgress(0);
    }, 0);

    const startingTimeout = setTimeout(() => {
      setLoadingState("generating");

      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progressPercentage = Math.min(
          100,
          (elapsedTime / duration) * 100
        );

        setProgress(progressPercentage);

        if (progressPercentage >= 100) {
          clearInterval(interval);
          // Don't set to completed automatically here, wait for isScanning to turn false
          // if we want to simulate an indefinite scan. But we'll follow original logic.
        }
      }, 16);

      return () => {
        clearInterval(interval);
      };
    }, 1000); // Wait 1 second before scan starts

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(startingTimeout);
    };
  }, [duration, isScanning]);

  return (
    <div className="image-gen-container">
      {isScanning && (
        <motion.span
          className="image-gen-text"
          initial={{ backgroundPosition: "200% 0" }}
          animate={{
            backgroundPosition: loadingState === "completed" ? "0% 0" : "-200% 0",
          }}
          transition={{
            repeat: loadingState === "completed" ? 0 : Infinity,
            duration: 3,
            ease: "linear",
          }}
        >
          {loadingState === "starting" && "Preparing image scan..."}
          {loadingState === "generating" && "Scanning image. May take a moment..."}
          {loadingState === "completed" && "Scan complete."}
        </motion.span>
      )}
      <div className="image-gen-card">
        {children}
        <motion.div
          className="image-gen-blur"
          initial={false}
          animate={{
            clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
            opacity: loadingState === "completed" ? 0 : 1,
          }}
          style={{
            clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
            maskImage:
              progress === 0
                ? "linear-gradient(to bottom, black -5%, black 100%)"
                : `linear-gradient(to bottom, transparent ${Math.max(0, progress - 5)}%, transparent ${progress}%, black ${Math.min(100, progress + 5)}%)`,
            WebkitMaskImage:
              progress === 0
                ? "linear-gradient(to bottom, black -5%, black 100%)"
                : `linear-gradient(to bottom, transparent ${Math.max(0, progress - 5)}%, transparent ${progress}%, black ${Math.min(100, progress + 5)}%)`,
          }}
        />
      </div>
    </div>
  );
};

ImageGeneration.displayName = "ImageGeneration";
