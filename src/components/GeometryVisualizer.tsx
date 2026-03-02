import { useEffect, useRef } from 'react';

interface GeometryVisualizerProps {
  geometry: {
    cellShape: string;
    radius?: number;
    length?: number;
    width?: number;
    cellNumberX: number;
    cellNumberY: number;
    pitchX: number;
    pitchY: number;
  };
}

export default function GeometryVisualizer({ geometry }: GeometryVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale
    const totalWidth = geometry.pitchX * geometry.cellNumberX;
    const totalHeight = geometry.pitchY * geometry.cellNumberY;
    const scale = Math.min(
      (canvas.width - 40) / totalWidth,
      (canvas.height - 40) / totalHeight
    );

    const offsetX = (canvas.width - totalWidth * scale) / 2;
    const offsetY = (canvas.height - totalHeight * scale) / 2;

    // Draw background grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= geometry.cellNumberX; i++) {
      const x = offsetX + i * geometry.pitchX * scale;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + totalHeight * scale);
      ctx.stroke();
    }
    for (let j = 0; j <= geometry.cellNumberY; j++) {
      const y = offsetY + j * geometry.pitchY * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + totalWidth * scale, y);
      ctx.stroke();
    }

    // Draw cells
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;

    for (let i = 0; i < geometry.cellNumberX; i++) {
      for (let j = 0; j < geometry.cellNumberY; j++) {
        const centerX = offsetX + (i + 0.5) * geometry.pitchX * scale;
        const centerY = offsetY + (j + 0.5) * geometry.pitchY * scale;

        ctx.beginPath();

        if (geometry.cellShape === 'circular') {
          const radius = (geometry.radius || 50) * scale;
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else if (geometry.cellShape === 'rectangular') {
          const w = (geometry.length || 100) * scale;
          const h = (geometry.width || 80) * scale;
          ctx.rect(centerX - w / 2, centerY - h / 2, w, h);
        } else if (geometry.cellShape === 'hexagonal') {
          const side = (geometry.radius || 40) * scale;
          for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k - Math.PI / 6;
            const x = centerX + side * Math.cos(angle);
            const y = centerY + side * Math.sin(angle);
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
        }

        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw dimensions
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // Width dimension
    ctx.fillText(
      `${totalWidth.toFixed(0)} μm`,
      canvas.width / 2,
      offsetY + totalHeight * scale + 25
    );

    // Height dimension
    ctx.save();
    ctx.translate(offsetX - 25, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${totalHeight.toFixed(0)} μm`, 0, 0);
    ctx.restore();

  }, [geometry]);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Array Preview</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full bg-white rounded border border-gray-200"
      />
      <div className="mt-2 text-xs text-gray-500 text-center">
        {geometry.cellNumberX} × {geometry.cellNumberY} array = {geometry.cellNumberX * geometry.cellNumberY} cells
      </div>
    </div>
  );
}
