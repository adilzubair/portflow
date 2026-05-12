"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface MeasuredSize {
  width: number;
  height: number;
}

export default function MeasuredChart({
  className,
  children,
}: {
  className?: string;
  children: (size: MeasuredSize) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<MeasuredSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    let frameId = 0;

    const updateSize = () => {
      const nextWidth = Math.floor(element.clientWidth);
      const nextHeight = Math.floor(element.clientHeight);

      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(updateSize);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
