import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Cpu, Monitor, Cloud, AlertCircle, Loader, Upload, Settings2, FileText, Copy, Check, X } from 'lucide-react';
import { useSimulation, ECMParameters, defaultECMParams } from '../context/SimulationContext';
import { simulationApi } from '../services/api';
import clsx from 'clsx';

interface PolygonPoint {
  x: number;
  y: number;
}

// Example shape data (circle with 100μm radius in meters)
const EXAMPLE_SHAPE = `X,Y
1.000000000000000e-04,0.000000000000000e+00
9.807852804032305e-05,1.950903220161283e-05
9.238795325112868e-05,3.826834323650898e-05
8.314696123025452e-05,5.555702330196022e-05
7.071067811865475e-05,7.071067811865475e-05
5.555702330196023e-05,8.314696123025452e-05
3.826834323650899e-05,9.238795325112868e-05
1.950903220161284e-05,9.807852804032305e-05
6.123233995736766e-21,1.000000000000000e-04
-1.950903220161282e-05,9.807852804032305e-05
-3.826834323650897e-05,9.238795325112868e-05
-5.555702330196020e-05,8.314696123025455e-05
-7.071067811865475e-05,7.071067811865475e-05
-8.314696123025454e-05,5.555702330196022e-05
-9.238795325112868e-05,3.826834323650899e-05
-9.807852804032305e-05,1.950903220161286e-05
-1.000000000000000e-04,1.224646799147353e-20
-9.807852804032305e-05,-1.950903220161284e-05
-9.238795325112869e-05,-3.826834323650897e-05
-8.314696123025455e-05,-5.555702330196020e-05
-7.071067811865477e-05,-7.071067811865475e-05
-5.555702330196022e-05,-8.314696123025452e-05
-3.826834323650903e-05,-9.238795325112866e-05
-1.950903220161287e-05,-9.807852804032303e-05
-1.836970198721030e-20,-1.000000000000000e-04
1.950903220161283e-05,-9.807852804032305e-05
3.826834323650901e-05,-9.238795325112866e-05
5.555702330196018e-05,-8.314696123025455e-05
7.071067811865474e-05,-7.071067811865477e-05
8.314696123025452e-05,-5.555702330196022e-05
9.238795325112866e-05,-3.826834323650904e-05
9.807852804032303e-05,-1.950903220161287e-05
1.000000000000000e-04,-2.449293598294707e-20`;

interface DeviceInfo {
  id: string;
  name: string;
  available: boolean;
  description: string;
}

export default function SimulatePage() {
  const navigate = useNavigate();
  const { state, updateState } = useSimulation();
  
  // Shape file state
  const [shapeFile, setShapeFile] = useState<File | null>(state.shapeFile?.file || null);
  const [shapeContent, setShapeContent] = useState<string>('');
  const [polygonPoints, setPolygonPoints] = useState<PolygonPoint[]>([]);
  const [showExample, setShowExample] = useState(false);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [shapeError, setShapeError] = useState<string | null>(null);
  const [inputUnit, setInputUnit] = useState<'m' | 'um'>('m'); // meters or micrometers
  
  // Shape type selection
  type ShapeType = 'circular' | 'rectangular' | 'manual';
  const [shapeType, setShapeType] = useState<ShapeType>('circular');
  const [circleRadius, setCircleRadius] = useState<number>(100); // in μm
  const [rectWidth, setRectWidth] = useState<number>(200); // in μm
  const [rectHeight, setRectHeight] = useState<number>(200); // in μm
  const [circlePoints] = useState<number>(100); // number of points for circle
  
  // Array arrangement type
  type ArrayArrangement = 'interlaced' | 'normal';
  const [arrayArrangement, setArrayArrangement] = useState<ArrayArrangement>('interlaced');
  
  // ECM Parameters state - from ECM/main.py
  const [ecmParams, setEcmParams] = useState<ECMParameters>(
    state.ecmParams || defaultECMParams
  );
  
  // Physical overlap detection using actual polygon intersection
  const overlapInfo = useMemo(() => {
    if (polygonPoints.length < 3) return null;
    
    // Get cell bounding box (in μm)
    const xs = polygonPoints.map(p => p.x * 1e6);
    const ys = polygonPoints.map(p => p.y * 1e6);
    const cellWidth = Math.max(...xs) - Math.min(...xs);
    const cellHeight = Math.max(...ys) - Math.min(...ys);
    
    // Convert polygon points to μm for calculations
    const cellPolygon = polygonPoints.map(p => ({ x: p.x * 1e6, y: p.y * 1e6 }));
    
    // Helper: Check if two line segments intersect
    const segmentsIntersect = (
      p1: {x: number, y: number}, p2: {x: number, y: number},
      p3: {x: number, y: number}, p4: {x: number, y: number}
    ): boolean => {
      const ccw = (A: {x: number, y: number}, B: {x: number, y: number}, C: {x: number, y: number}) => {
        return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
      };
      return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
    };
    
    // Helper: Check if point is inside polygon (ray casting)
    const pointInPolygon = (point: {x: number, y: number}, polygon: {x: number, y: number}[]): boolean => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        if (((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    };
    
    // Helper: Check if two polygons overlap
    const polygonsOverlap = (poly1: {x: number, y: number}[], poly2: {x: number, y: number}[]): boolean => {
      // Check edge intersections
      for (let i = 0; i < poly1.length - 1; i++) {
        for (let j = 0; j < poly2.length - 1; j++) {
          if (segmentsIntersect(poly1[i], poly1[i + 1], poly2[j], poly2[j + 1])) {
            return true;
          }
        }
      }
      // Check if any vertex of poly1 is inside poly2
      for (const p of poly1) {
        if (pointInPolygon(p, poly2)) return true;
      }
      // Check if any vertex of poly2 is inside poly1
      for (const p of poly2) {
        if (pointInPolygon(p, poly1)) return true;
      }
      return false;
    };
    
    // Generate cell positions and check for overlaps
    const overlappingPairs: { cell1: number; cell2: number; row1: number; col1: number; row2: number; col2: number }[] = [];
    
    // Only check if we have more than 1 cell
    if (ecmParams.nx * ecmParams.ny > 1) {
      // Generate all cell offsets
      const cellOffsets: { x: number; y: number; row: number; col: number; idx: number }[] = [];
      let idx = 0;
      for (let row = 0; row < ecmParams.ny; row++) {
        for (let col = 0; col < ecmParams.nx; col++) {
          const xOffset = arrayArrangement === 'interlaced' && row % 2 === 1 
            ? col * ecmParams.dx + ecmParams.dx / 2 
            : col * ecmParams.dx;
          cellOffsets.push({ x: xOffset, y: row * ecmParams.dy, row, col, idx: idx++ });
        }
      }
      
      // Check adjacent cells for overlap (limit checks for performance)
      for (let i = 0; i < cellOffsets.length; i++) {
        for (let j = i + 1; j < cellOffsets.length; j++) {
          const c1 = cellOffsets[i];
          const c2 = cellOffsets[j];
          
          // Quick distance check to skip far cells
          const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2);
          if (dist > cellWidth + cellHeight) continue; // Too far to overlap
          
          // Create translated polygons
          const poly1 = cellPolygon.map(p => ({ x: p.x + c1.x, y: p.y + c1.y }));
          const poly2 = cellPolygon.map(p => ({ x: p.x + c2.x, y: p.y + c2.y }));
          
          if (polygonsOverlap(poly1, poly2)) {
            overlappingPairs.push({
              cell1: c1.idx + 1,
              cell2: c2.idx + 1,
              row1: c1.row,
              col1: c1.col,
              row2: c2.row,
              col2: c2.col,
            });
          }
        }
      }
    }
    
    const hasOverlap = overlappingPairs.length > 0;
    
    return {
      hasOverlap,
      overlappingPairs,
      cellWidth,
      cellHeight,
      dx: ecmParams.dx,
      dy: ecmParams.dy,
    };
  }, [polygonPoints, ecmParams.dx, ecmParams.dy, ecmParams.nx, ecmParams.ny, arrayArrangement]);
  
  // Frequency range state
  const [freqRange, setFreqRange] = useState({
    start: state.freqRange.start,
    end: state.freqRange.end,
    points: state.freqRange.points,
  });
  
  // Compute resource selection
  type ComputeResource = 'colab' | 'local-gpu' | 'local-cpu';
  const [computeResource, setComputeResource] = useState<ComputeResource>('local-gpu');
  const [colabUrl, setColabUrl] = useState('');
  const [colabStatus, setColabStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [, setDevicesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [simStartTime, setSimStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<string>('0:00');
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Derived availability from devices (must be after devices state)
  // CPU is always available, GPU depends on detection
  const hasLocalGpu = devices.some(d => d.id === 'gpu' && d.available);
  // CPU is always available

  // Load available devices
  useEffect(() => {
    simulationApi.getDevices().then(response => {
      setDevices(response.data.devices || []);
      setDevicesLoaded(true);
    }).catch(err => {
      console.error('Failed to load devices:', err);
      setDevicesLoaded(true); // Mark as loaded even on error, CPU is always available
    });
  }, []);

  // Elapsed-time ticker while simulation runs
  useEffect(() => {
    if (!loading || !simStartTime) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - simStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setElapsedTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, simStartTime]);

  // Re-parse shape content when unit changes
  useEffect(() => {
    if (shapeContent) {
      const points = parseShapeContent(shapeContent, inputUnit);
      if (points.length >= 3) {
        setPolygonPoints(points);
      }
    }
  }, [inputUnit]);

  // Parse shape content (supports comma, space, tab separators)
  // Returns points in meters (internal unit)
  const parseShapeContent = (content: string, unit: 'm' | 'um'): PolygonPoint[] => {
    const lines = content.trim().split('\n');
    const points: PolygonPoint[] = [];
    const scale = unit === 'um' ? 1e-6 : 1; // Convert to meters if input is in μm
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines, comments, and header
      if (!trimmed || trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('x')) {
        continue;
      }
      
      // Split by comma, space, or tab
      const parts = trimmed.split(/[,\s\t]+/).filter(p => p.length > 0);
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]) * scale;
        const y = parseFloat(parts[1]) * scale;
        if (!isNaN(x) && !isNaN(y)) {
          points.push({ x, y });
        }
      }
    }
    
    return points;
  };

  // Validate closed loop (first point ~= last point)
  const isClosedLoop = (points: PolygonPoint[]): boolean => {
    if (points.length < 3) return false;
    const first = points[0];
    const last = points[points.length - 1];
    const tolerance = 1e-10; // Very small tolerance for floating point
    return Math.abs(first.x - last.x) < tolerance && Math.abs(first.y - last.y) < tolerance;
  };

  // Handle shape file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setShapeFile(file);
      setError(null);
      setShapeError(null);
      // Read file content
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string || '';
        setShapeContent(content);
        const points = parseShapeContent(content, inputUnit);
        if (points.length < 3) {
          setShapeError('Need at least 3 points to define a shape');
          setPolygonPoints([]);
        } else if (!isClosedLoop(points)) {
          setShapeError('Shape must be a closed loop (first point = last point)');
          setPolygonPoints(points); // Still show it
        } else {
          setPolygonPoints(points);
        }
      };
      reader.readAsText(file);
    }
  };

  // Handle paste content
  const handlePasteSubmit = () => {
    if (!pasteContent.trim()) return;
    
    setShapeError(null);
    const points = parseShapeContent(pasteContent, inputUnit);
    
    if (points.length < 3) {
      setShapeError('Need at least 3 points to define a shape');
      return;
    }
    
    if (!isClosedLoop(points)) {
      setShapeError('Shape must be a closed loop (first point = last point)');
    }
    
    setPolygonPoints(points);
    setShapeContent(pasteContent);
    // Create a virtual file
    const blob = new Blob([pasteContent], { type: 'text/plain' });
    const file = new File([blob], 'pasted_shape.txt', { type: 'text/plain' });
    setShapeFile(file);
    setShowPasteInput(false);
    setPasteContent('');
  };

  // Copy example to clipboard
  const handleCopyExample = async () => {
    await navigator.clipboard.writeText(EXAMPLE_SHAPE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load example directly
  const handleLoadExample = () => {
    const points = parseShapeContent(EXAMPLE_SHAPE, 'm'); // Example is always in meters
    setPolygonPoints(points);
    setInputUnit('m'); // Set unit to meters when loading example
    setShapeContent(EXAMPLE_SHAPE);
    const blob = new Blob([EXAMPLE_SHAPE], { type: 'text/plain' });
    const file = new File([blob], 'example_circle_100um.txt', { type: 'text/plain' });
    setShapeFile(file);
    setShapeError(null);
    setShowExample(false);
  };

  // Size limits (in μm)
  const MIN_SIZE = 100;
  const MAX_SIZE = 400;

  // Generate circular shape (exactly numPoints + 1 for closed loop)
  const generateCircle = (radiusUm: number, numPoints: number): PolygonPoint[] => {
    const radiusM = radiusUm * 1e-6; // Convert to meters
    const points: PolygonPoint[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      points.push({
        x: radiusM * Math.cos(angle),
        y: radiusM * Math.sin(angle),
      });
    }
    // Close the loop by adding first point again
    points.push({ ...points[0] });
    return points;
  };

  // Generate rectangular shape
  const generateRectangle = (widthUm: number, heightUm: number): PolygonPoint[] => {
    const halfW = (widthUm / 2) * 1e-6; // Convert to meters
    const halfH = (heightUm / 2) * 1e-6;
    return [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
      { x: -halfW, y: -halfH }, // Close the loop
    ];
  };

  // Generate shape content string from points
  const generateShapeContent = (points: PolygonPoint[]): string => {
    const lines = ['X,Y'];
    for (const p of points) {
      lines.push(`${p.x.toExponential(15)},${p.y.toExponential(15)}`);
    }
    return lines.join('\n');
  };

  // Handle shape generation for preset shapes
  const handleGenerateShape = () => {
    setShapeError(null);
    let points: PolygonPoint[] = [];
    let filename = '';

    if (shapeType === 'circular') {
      if (circleRadius < MIN_SIZE || circleRadius > MAX_SIZE) {
        setShapeError(`Radius must be between ${MIN_SIZE} and ${MAX_SIZE} μm`);
        return;
      }
      points = generateCircle(circleRadius, circlePoints);
      filename = `circle_${circleRadius}um.txt`;
    } else if (shapeType === 'rectangular') {
      if (rectWidth < MIN_SIZE || rectWidth > MAX_SIZE) {
        setShapeError(`Width must be between ${MIN_SIZE} and ${MAX_SIZE} μm`);
        return;
      }
      if (rectHeight < MIN_SIZE || rectHeight > MAX_SIZE) {
        setShapeError(`Height must be between ${MIN_SIZE} and ${MAX_SIZE} μm`);
        return;
      }
      points = generateRectangle(rectWidth, rectHeight);
      filename = `rect_${rectWidth}x${rectHeight}um.txt`;
    }

    if (points.length > 0) {
      setPolygonPoints(points);
      const content = generateShapeContent(points);
      setShapeContent(content);
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      setShapeFile(file);
    }
  };

  // Auto-generate when shape type or dimensions change
  useEffect(() => {
    if (shapeType !== 'manual') {
      handleGenerateShape();
    }
  }, [shapeType, circleRadius, rectWidth, rectHeight, circlePoints]);

  // Check Colab connection
  const checkColabConnection = async () => {
    if (!colabUrl) return;
    setColabStatus('checking');
    try {
      const cleanUrl = colabUrl.replace(/\/$/, '');
      const response = await fetch(`${cleanUrl}/health`);
      const data = await response.json();
      if (data.status === 'ok') {
        setColabStatus('connected');
        setError(null);
      } else {
        setColabStatus('error');
      }
    } catch {
      setColabStatus('error');
      setError('Cannot connect to Colab server. Make sure the notebook is running.');
    }
  };

  // Handle ECM parameter change
  const handleEcmParamChange = <K extends keyof ECMParameters>(
    key: K, 
    value: ECMParameters[K]
  ) => {
    setEcmParams(prev => ({ ...prev, [key]: value }));
  };

  // Helper: poll simulation progress until done or failed
  const pollProgress = async (simulationId: string): Promise<void> => {
    const POLL_INTERVAL = 1000; // 1 second – detect new results quickly
    const MAX_POLLS = 3600; // 1 hour max (3600 × 1s)
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      try {
        const resp = await simulationApi.getProgress(simulationId);
        const prog = resp.data;
        setProgress(Math.max(prog.progress, 5)); // always show at least 5%
        setProgressMessage(prog.current_step || 'Running...');
        if (prog.status === 'completed') return;
        if (prog.status === 'failed') {
          throw new Error(prog.current_step || 'Simulation failed');
        }
      } catch (err: any) {
        // 404 means id not found yet, keep polling
        if (err.response?.status === 404) continue;
        throw err;
      }
    }
    throw new Error('Simulation timed out');
  };

  // Handle simulation
  const handleSimulate = async () => {
    if (!shapeFile) {
      setError('Please upload a shape.txt file');
      return;
    }
    
    setLoading(true);
    setError(null);
    setProgress(0);
    setSimStartTime(Date.now());
    updateState({ currentStep: 1 }); // Move stepper to "Running"
    
    try {
      let data: any;
      
      if (computeResource === 'colab' && colabUrl && colabStatus === 'connected') {
        // Run on Colab GPU (direct / synchronous)
        setProgressMessage('Sending to Colab GPU...');
        setProgress(20);
        
        const autoSequence = Array(ecmParams.nx * ecmParams.ny).fill(1);
        
        const cleanUrl = colabUrl.replace(/\/$/, '');
        const response = await fetch(`${cleanUrl}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shape_content: shapeContent,
            freq_start: freqRange.start,
            freq_end: freqRange.end,
            freq_points: freqRange.points,
            n_modes: ecmParams.nModes,
            nx: ecmParams.nx,
            ny: ecmParams.ny,
            dx: ecmParams.dx,
            dy: ecmParams.dy,
            h_piezo: ecmParams.hPiezo,
            h_stru: ecmParams.hStru,
            sequence: autoSequence,
            threshold: ecmParams.threshold,
            array_arrangement: arrayArrangement,
          }),
        });
        
        data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Colab simulation failed');
        }
        data.simulation_id = 'colab-' + Date.now();
        
      } else {
        // Run on local backend (GPU or CPU) — async with polling
        const deviceLabel = computeResource === 'local-gpu' ? 'Local GPU' : 'Local CPU';
        setProgressMessage(`Submitting to ${deviceLabel}...`);
        setProgress(5);
        
        const autoSequence = Array(ecmParams.nx * ecmParams.ny).fill(1);
        
        // 1. Submit — returns immediately with simulation_id
        const submitResp = await simulationApi.run({
          device: computeResource === 'local-gpu' ? 'cuda' : 'cpu',
          shapeFile: shapeFile,
          sequence: autoSequence,
          dx: ecmParams.dx,
          dy: ecmParams.dy,
          n: ecmParams.n,
          nx: ecmParams.nx,
          ny: ecmParams.ny,
          hPiezo: ecmParams.hPiezo,
          hStru: ecmParams.hStru,
          nModes: ecmParams.nModes,
          threshold: ecmParams.threshold,
          freqStart: freqRange.start,
          freqEnd: freqRange.end,
          freqPoints: freqRange.points,
          arrayArrangement: arrayArrangement,
        });
        const simulationId = submitResp.data.simulation_id;

        // 2. Poll progress until completed
        setProgressMessage(`Running on ${deviceLabel}...`);
        await pollProgress(simulationId);

        // 3. Fetch full results
        setProgressMessage('Fetching results...');
        setProgress(95);
        const resultResp = await simulationApi.getResult(simulationId);
        data = resultResp.data;
      }
      
      setProgress(100);
      setProgressMessage('Complete!');
      
      // Update global state
      updateState({
        shapeFile: { file: shapeFile, filename: shapeFile.name },
        ecmParams,
        freqRange,
        simulation: {
          peakFrequency: data.peak_frequency,
          peakPower: data.peak_power,
          bandwidth3db: data.bandwidth_3db,
          computationTime: data.computation_time,
          deviceUsed: data.device_used,
          frequencies: data.frequencies,
          outputPower: data.output_power,
          powerDb: data.power_db,
          impedanceReal: data.impedance_real,
          impedanceImag: data.impedance_imag,
          phase: data.phase,
          hasVibration: data.has_vibration,
          nVibrationFrames: data.n_vibration_frames,
        },
        simulationId: data.simulation_id,
        currentStep: 2,  // Output step
      });
      
      navigate('/output');
    } catch (err: any) {
      setError(err.message || err.response?.data?.detail || 'Simulation failed');
      updateState({ currentStep: 0 }); // Back to Input on failure
    } finally {
      setLoading(false);
    }
  };

  const formatFrequency = (freq: number) => {
    if (freq >= 1e6) return `${(freq / 1e6).toFixed(2)} MHz`;
    if (freq >= 1e3) return `${(freq / 1e3).toFixed(1)} kHz`;
    return `${freq.toFixed(0)} Hz`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mutimodal PMUT Array Equivalent Circuit Modelling (ECM)</h2>
        <p className="mt-1 text-gray-600">
          Upload shape.txt and configure ECM parameters to run simulation.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* ========== RUNNING DASHBOARD (shown during simulation) ========== */}
      {loading ? (
        <div className="space-y-6">
          {/* Main progress card */}
          <div className="bg-gradient-to-br from-amber-50 via-white to-primary-50 rounded-xl border border-amber-200 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-4">
                <Loader className="w-10 h-10 text-amber-600 animate-spin" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Simulation Running</h3>
              <p className="text-gray-500 mt-1">ECM pipeline is processing your PMUT design</p>
            </div>

            {/* Progress bar */}
            <div className="max-w-lg mx-auto mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">{progressMessage || 'Initializing...'}</span>
                <span className="font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-400 to-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
              </div>
            </div>

            {/* Elapsed time */}
            <div className="text-center">
              <span className="inline-flex items-center px-4 py-2 bg-white rounded-full border border-gray-200 text-sm">
                <span className="text-gray-500 mr-2">Elapsed:</span>
                <span className="font-mono font-semibold text-gray-800">{elapsedTime}</span>
              </span>
            </div>
          </div>

          {/* Pipeline stages */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Pipeline Stages</h4>
            <div className="space-y-3">
              {[
                { label: 'Cleaning old results',       threshold: 2 },
                { label: 'Preparing polygon files',    threshold: 5 },
                { label: 'Loading ECM module',         threshold: 10 },
                { label: 'Computing eigenmodes',       threshold: 12 },
                { label: 'Computing eigenfrequencies', threshold: 14 },
                { label: 'Eigenvibration stacking',    threshold: 16 },
                { label: 'Array generation',           threshold: 18 },
                { label: 'Acoustic impedance (GPU)',   threshold: 20 },
                { label: 'Mechanical impedance',       threshold: 50 },
                { label: 'Output power & current',     threshold: 70 },
                { label: 'Vibration field',            threshold: 80 },
                { label: 'Plotting results',           threshold: 88 },
                { label: 'Collecting output files',    threshold: 90 },
              ].map((stage, idx) => {
                const isComplete = progress > stage.threshold;
                const nextThreshold = idx < 12 ? [2,5,10,12,14,16,18,20,50,70,80,88,90][idx+1] : 100;
                const isActive = progress >= stage.threshold && progress < nextThreshold;
                return (
                  <div key={idx} className="flex items-center space-x-3">
                    <div className={clsx(
                      'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs',
                      isComplete ? 'bg-green-100 text-green-600' :
                      isActive ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-400'
                    )}>
                      {isComplete ? '✓' : isActive ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (idx + 1)}
                    </div>
                    <span className={clsx(
                      'text-sm',
                      isComplete ? 'text-green-700' :
                      isActive ? 'text-amber-700 font-medium' :
                      'text-gray-400'
                    )}>
                      {stage.label}
                    </span>
                    {isActive && (
                      <span className="text-xs text-amber-500 animate-pulse">● running</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulation parameters summary */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Simulation Parameters</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400">Shape:</span> <span className="font-medium text-gray-700">{shapeFile?.name || '—'}</span></div>
              <div><span className="text-gray-400">Array:</span> <span className="font-medium text-gray-700">{ecmParams.nx}×{ecmParams.ny}</span></div>
              <div><span className="text-gray-400">Pitch:</span> <span className="font-medium text-gray-700">{ecmParams.dx}×{ecmParams.dy} μm</span></div>
              <div><span className="text-gray-400">Modes:</span> <span className="font-medium text-gray-700">{ecmParams.nModes}</span></div>
              <div><span className="text-gray-400">h_piezo:</span> <span className="font-medium text-gray-700">{ecmParams.hPiezo} μm</span></div>
              <div><span className="text-gray-400">h_stru:</span> <span className="font-medium text-gray-700">{ecmParams.hStru} μm</span></div>
              <div><span className="text-gray-400">Freq:</span> <span className="font-medium text-gray-700">{formatFrequency(freqRange.start)}–{formatFrequency(freqRange.end)}</span></div>
              <div><span className="text-gray-400">Points:</span> <span className="font-medium text-gray-700">{freqRange.points}</span></div>
            </div>
          </div>
        </div>
      ) : (
      /* ========== INPUT FORM (shown when not loading) ========== */
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column - Inputs */}
        <div className="space-y-6">
          {/* Shape Definition */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              1. Shape Boundary (Closed Loop)
            </h3>
            
            {/* Shape Type Selection */}
            <div className="flex space-x-2 mb-3">
              <button
                onClick={() => setShapeType('circular')}
                className={clsx(
                  'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                  shapeType === 'circular'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600'
                )}
              >
                ⭕ Circular
              </button>
              <button
                onClick={() => setShapeType('rectangular')}
                className={clsx(
                  'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                  shapeType === 'rectangular'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600'
                )}
              >
                ⬜ Rectangular
              </button>
              <button
                onClick={() => setShapeType('manual')}
                className={clsx(
                  'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                  shapeType === 'manual'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600'
                )}
              >
                📝 Manual
              </button>
            </div>
            
            {/* Circular Input */}
            {shapeType === 'circular' && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Radius (μm)</label>
                  <input
                    type="number"
                    value={circleRadius}
                    onChange={e => setCircleRadius(parseFloat(e.target.value) || 100)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step="1"
                  />
                  <p className="text-xs text-gray-400 mt-1">Range: {MIN_SIZE} - {MAX_SIZE} μm</p>
                </div>
              </div>
            )}
            
            {/* Rectangular Input */}
            {shapeType === 'rectangular' && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Width (μm)</label>
                    <input
                      type="number"
                      value={rectWidth}
                      onChange={e => setRectWidth(parseFloat(e.target.value) || 200)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      min={MIN_SIZE}
                      max={MAX_SIZE}
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Height (μm)</label>
                    <input
                      type="number"
                      value={rectHeight}
                      onChange={e => setRectHeight(parseFloat(e.target.value) || 200)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      min={MIN_SIZE}
                      max={MAX_SIZE}
                      step="1"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Range: {MIN_SIZE} - {MAX_SIZE} μm for each dimension</p>
              </div>
            )}
            
            {/* Manual Input */}
            {shapeType === 'manual' && (
              <div className="space-y-3">
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowExample(true)}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Example</span>
                  </button>
                  <button
                    onClick={() => setShowPasteInput(!showPasteInput)}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Paste</span>
                  </button>
                </div>
            
            {/* Example Modal */}
            {showExample && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-900">Example Shape File</h4>
                    <button onClick={() => setShowExample(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 mb-3 space-y-2">
                    <p>CSV or TXT format with X,Y coordinates. Must be a closed loop (first point = last point).</p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs">
                      <strong>Supported formats:</strong>
                      <ul className="mt-1 ml-4 list-disc">
                        <li>Comma separated: <code>X,Y</code></li>
                        <li>Space separated: <code>X Y</code></li>
                        <li>Tab separated: <code>X\tY</code></li>
                      </ul>
                    </div>
                    <p className="text-xs text-amber-600">⚠️ This example uses <strong>meters</strong> unit. Select the correct unit before loading!</p>
                  </div>
                  <pre className="bg-gray-50 p-3 rounded-lg text-xs font-mono overflow-auto max-h-48 mb-4 border">
                    {EXAMPLE_SHAPE}
                  </pre>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleCopyExample}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={handleLoadExample}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Load Example (meters)
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Paste Input */}
            {showPasteInput && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600">Paste X,Y coordinates:</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    Unit: {inputUnit === 'm' ? 'meters' : 'micrometers (μm)'}
                  </span>
                </div>
                <textarea
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder={inputUnit === 'm' 
                    ? "X,Y\n5.0e-05,0.0e+00\n4.9e-05,9.7e-06\n...\n5.0e-05,0.0e+00"
                    : "X,Y\n50.0,0.0\n49.0,9.7\n...\n50.0,0.0"
                  }
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Supports comma, space, or tab separators. First point must equal last point (closed loop).</p>
                <div className="flex justify-end space-x-2 mt-2">
                  <button
                    onClick={() => { setShowPasteInput(false); setPasteContent(''); }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasteSubmit}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Load Shape
                  </button>
                </div>
              </div>
            )}
            
            {/* Unit Selection */}
            <div className="flex items-center space-x-4 mb-2">
              <span className="text-xs text-gray-500">Input unit:</span>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  name="unit"
                  checked={inputUnit === 'm'}
                  onChange={() => setInputUnit('m')}
                  className="w-3 h-3 text-primary-600"
                />
                <span className="text-xs text-gray-700">meters (m)</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  name="unit"
                  checked={inputUnit === 'um'}
                  onChange={() => setInputUnit('um')}
                  className="w-3 h-3 text-primary-600"
                />
                <span className="text-xs text-gray-700">micrometers (μm)</span>
              </label>
            </div>
            
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors">
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="shape-upload"
              />
              <label htmlFor="shape-upload" className="cursor-pointer">
                <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                <p className="text-sm text-gray-600">
                  {shapeFile ? (
                    <span className="text-primary-600 font-medium">{shapeFile.name}</span>
                  ) : (
                    'Click to upload or drag & drop'
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  .txt or .csv: X,Y coordinates, closed loop
                </p>
              </label>
            </div>
              </div>
            )}
            
            {/* Shape Error */}
            {shapeError && (
              <div className="mt-2 text-xs text-amber-600 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>{shapeError}</span>
              </div>
            )}
            
            {/* Polygon Visualization */}
            {polygonPoints.length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">
                    {polygonPoints.length} points loaded
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-2 space-y-0.5">
                  {(() => {
                    const xs = polygonPoints.map(p => p.x);
                    const ys = polygonPoints.map(p => p.y);
                    const xMin = Math.min(...xs) * 1e6;
                    const xMax = Math.max(...xs) * 1e6;
                    const yMin = Math.min(...ys) * 1e6;
                    const yMax = Math.max(...ys) * 1e6;
                    const xRange = xMax - xMin;
                    const yRange = yMax - yMin;
                    return (
                      <>
                        <div>X range: {xMin.toFixed(2)} to {xMax.toFixed(2)} μm (width: {xRange.toFixed(2)} μm)</div>
                        <div>Y range: {yMin.toFixed(2)} to {yMax.toFixed(2)} μm (height: {yRange.toFixed(2)} μm)</div>
                      </>
                    );
                  })()}
                </div>
                {(() => {
                  // Calculate dynamic viewBox based on shape size
                  const xs = polygonPoints.map(p => p.x * 1e6); // Convert to μm
                  const ys = polygonPoints.map(p => p.y * 1e6);
                  const xMin = Math.min(...xs);
                  const xMax = Math.max(...xs);
                  const yMin = Math.min(...ys);
                  const yMax = Math.max(...ys);
                  const padding = Math.max(xMax - xMin, yMax - yMin) * 0.1; // 10% padding
                  const size = Math.max(xMax - xMin, yMax - yMin) + padding * 2;
                  const centerX = (xMin + xMax) / 2;
                  const centerY = (yMin + yMax) / 2;
                  
                  return (
                    <svg
                      viewBox={`${centerX - size/2} ${centerY - size/2} ${size} ${size}`}
                      className="w-full h-32 bg-white rounded border border-gray-200"
                      style={{ transform: 'scaleY(-1)' }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Grid lines */}
                      <line x1={centerX - size/2} y1="0" x2={centerX + size/2} y2="0" stroke="#e5e7eb" strokeWidth={size * 0.005} />
                      <line x1="0" y1={centerY - size/2} x2="0" y2={centerY + size/2} stroke="#e5e7eb" strokeWidth={size * 0.005} />
                      
                      {/* Polygon */}
                      <polygon
                        points={polygonPoints.map(p => `${p.x * 1e6},${p.y * 1e6}`).join(' ')}
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="#3b82f6"
                        strokeWidth={size * 0.01}
                      />
                      
                      {/* Center dot */}
                      <circle cx="0" cy="0" r={size * 0.015} fill="#ef4444" />
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ECM Parameters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <span>2. ECM Parameters</span>
                {overlapInfo?.hasOverlap && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded animate-pulse">
                    ⚠️ Overlap
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>{showAdvanced ? 'Hide' : 'Show'} Advanced</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
              {/* Array arrangement type */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Array Arrangement</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setArrayArrangement('interlaced')}
                    className={clsx(
                      'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors',
                      arrayArrangement === 'interlaced'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-600'
                    )}
                  >
                    🔀 Interlaced (Hexagonal)
                  </button>
                  <button
                    onClick={() => setArrayArrangement('normal')}
                    className={clsx(
                      'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors',
                      arrayArrangement === 'normal'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-600'
                    )}
                  >
                    ⬛ Normal (Grid)
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {arrayArrangement === 'interlaced' 
                    ? 'Odd rows shifted by dx/2 for hexagonal packing' 
                    : 'Regular grid arrangement'}
                </p>
              </div>
              
              {/* Array dimensions */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">nx (cell number in X direction)</label>
                <input
                  type="number"
                  value={ecmParams.nx}
                  onChange={e => handleEcmParamChange('nx', Math.min(32, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="1"
                  max="32"
                />
                <p className="text-xs text-gray-400 mt-1">Max: 32</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ny (cell number in Y direction)</label>
                <input
                  type="number"
                  value={ecmParams.ny}
                  onChange={e => handleEcmParamChange('ny', Math.min(32, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="1"
                  max="32"
                />
                <p className="text-xs text-gray-400 mt-1">Max: 32</p>
              </div>
              
              {/* Cell gaps */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">dx (cell distance in X direction, μm)</label>
                <input
                  type="number"
                  value={ecmParams.dx}
                  onChange={e => handleEcmParamChange('dx', parseFloat(e.target.value) || 500)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">dy (cell distance in Y direction, μm)</label>
                <input
                  type="number"
                  value={ecmParams.dy}
                  onChange={e => handleEcmParamChange('dy', parseFloat(e.target.value) || 500)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="1"
                />
              </div>
              
              {/* Number of modes */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Number of Modes</label>
                <input
                  type="number"
                  value={ecmParams.nModes}
                  onChange={e => handleEcmParamChange('nModes', parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="1"
                  max="20"
                />
              </div>
              
              {/* Layer thicknesses */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">h_piezo (Piezo thickness, μm)</label>
                <input
                  type="number"
                  value={ecmParams.hPiezo}
                  onChange={e => handleEcmParamChange('hPiezo', parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="0.1"
                  max="20"
                  step="0.1"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 1.0 μm</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">h_stru (Structural thickness, μm)</label>
                <input
                  type="number"
                  value={ecmParams.hStru}
                  onChange={e => handleEcmParamChange('hStru', parseFloat(e.target.value) || 5.0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="0.1"
                  max="100"
                  step="0.1"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 5.0 μm</p>
              </div>
              
              {/* Advanced parameters */}
              {showAdvanced && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">n (pistons/line)</label>
                    <input
                      type="number"
                      value={ecmParams.n}
                      onChange={e => handleEcmParamChange('n', parseInt(e.target.value) || 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      min="2"
                      max="50"
                    />
                    <p className="text-xs text-gray-400 mt-1">Default: 16 (recommended: 10-20)</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">threshold</label>
                    <input
                      type="number"
                      value={ecmParams.threshold}
                      onChange={e => handleEcmParamChange('threshold', parseFloat(e.target.value) || 0.05)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      min="0"
                      max="1"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-400 mt-1">Default: 0.05 (recommended: 0.01-0.1)</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Sequence (auto-generated)</label>
                    <div className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm font-mono text-gray-600">
                      [1] × {ecmParams.nx * ecmParams.ny}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{ecmParams.nx} × {ecmParams.ny} = {ecmParams.nx * ecmParams.ny} cells</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Overlap Warning */}
            {overlapInfo?.hasOverlap && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-700">
                  <div className="font-medium mb-1">⚠️ Physical Cell Overlap Detected!</div>
                  <div className="space-y-0.5">
                    <div>Cell size: {overlapInfo.cellWidth.toFixed(1)} × {overlapInfo.cellHeight.toFixed(1)} μm</div>
                    <div>Cell pitch: {overlapInfo.dx} × {overlapInfo.dy} μm</div>
                    <div className="text-red-600 font-medium">
                      {overlapInfo.overlappingPairs.length} overlapping cell pair{overlapInfo.overlappingPairs.length > 1 ? 's' : ''} found
                    </div>
                    {overlapInfo.overlappingPairs.slice(0, 3).map((pair, i) => (
                      <div key={i} className="text-red-600">
                        • Cell {pair.cell1} (row {pair.row1}, col {pair.col1}) ↔ Cell {pair.cell2} (row {pair.row2}, col {pair.col2})
                      </div>
                    ))}
                    {overlapInfo.overlappingPairs.length > 3 && (
                      <div className="text-red-500">...and {overlapInfo.overlappingPairs.length - 3} more</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Frequency Range */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">3. Frequency Range</h3>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start (MHz)</label>
                <input
                  type="number"
                  value={freqRange.start / 1e6}
                  onChange={e => setFreqRange(prev => ({ ...prev, start: parseFloat(e.target.value) * 1e6 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End (MHz)</label>
                <input
                  type="number"
                  value={freqRange.end / 1e6}
                  onChange={e => setFreqRange(prev => ({ ...prev, end: parseFloat(e.target.value) * 1e6 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Frequency Points</label>
                <input
                  type="number"
                  value={freqRange.points}
                  onChange={e => setFreqRange(prev => ({ ...prev, points: parseInt(e.target.value) || 50 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  min="10"
                  max="1000"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 50 points</p>
              </div>
            </div>
          </div>

          {/* Computation Resource */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">4. Computation Resource</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {/* Local CPU Option – disabled / Under Development */}
              <div className="flex items-center space-x-3 opacity-50 cursor-not-allowed">
                <input
                  type="radio"
                  id="local-cpu"
                  name="computeResource"
                  checked={computeResource === 'local-cpu'}
                  onChange={() => {}}
                  disabled
                  className="w-4 h-4 text-gray-300 border-gray-300"
                />
                <Cpu className="w-4 h-4 text-gray-400" />
                <label htmlFor="local-cpu" className="text-sm text-gray-400 flex-1">
                  Local CPU
                </label>
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-50 text-yellow-600">
                  Under Development
                </span>
              </div>
              
              {/* Local GPU Option */}
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  id="local-gpu"
                  name="computeResource"
                  checked={computeResource === 'local-gpu'}
                  onChange={() => setComputeResource('local-gpu')}
                  disabled={!hasLocalGpu}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <Monitor className="w-4 h-4 text-green-500" />
                <label htmlFor="local-gpu" className={clsx(
                  'text-sm flex-1',
                  hasLocalGpu ? 'text-gray-700' : 'text-gray-400'
                )}>
                  Local GPU (CUDA)
                </label>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded',
                  hasLocalGpu ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                )}>
                  {hasLocalGpu ? 'Available' : 'Not detected'}
                </span>
              </div>
              
              {/* Colab GPU Option – disabled / Under Development */}
              <div className="flex items-center space-x-3 opacity-50 cursor-not-allowed">
                <input
                  type="radio"
                  id="colab"
                  name="computeResource"
                  checked={computeResource === 'colab'}
                  onChange={() => {}}
                  disabled
                  className="w-4 h-4 text-gray-300 border-gray-300"
                />
                <Cloud className="w-4 h-4 text-gray-400" />
                <label htmlFor="colab" className="text-sm text-gray-400 flex-1">
                  Google Colab GPU
                </label>
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-50 text-yellow-600">
                  Under Development
                </span>
              </div>
              
              {/* Colab URL Input hidden since Colab is disabled */}
              {computeResource === 'colab' && (
                <div className="ml-7 space-y-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Run the Colab notebook and paste the ngrok URL below.
                  </p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={colabUrl}
                      onChange={e => setColabUrl(e.target.value)}
                      placeholder="https://xxxx-xx-xx-xx-xx.ngrok-free.app"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={checkColabConnection}
                      disabled={!colabUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      Connect
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={clsx(
                      'w-2 h-2 rounded-full',
                      colabStatus === 'connected' ? 'bg-green-500' :
                      colabStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
                      colabStatus === 'error' ? 'bg-red-500' : 'bg-gray-300'
                    )} />
                    <span className="text-xs text-gray-500">
                      {colabStatus === 'connected' ? 'Connected to Colab GPU' :
                       colabStatus === 'checking' ? 'Checking connection...' :
                       colabStatus === 'error' ? 'Connection failed' : 'Not connected'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column - Array Preview (auto-shown when shape is ready) */}
        <div className="space-y-6">
          {polygonPoints.length >= 3 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Array Layout Preview</h3>
              
              {/* Array info */}
              <div className="text-xs text-gray-600 mb-3 grid grid-cols-2 gap-1">
                <div>Array: {ecmParams.nx} × {ecmParams.ny} = {ecmParams.nx * ecmParams.ny} cells</div>
                <div>Pitch: {ecmParams.dx} × {ecmParams.dy} μm</div>
                <div className="col-span-2">Arrangement: {arrayArrangement === 'interlaced' ? 'Interlaced (Hexagonal)' : 'Normal (Grid)'}</div>
              </div>
              
              {/* Overlap Warning */}
              {overlapInfo?.hasOverlap && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-700">
                    <div className="font-semibold mb-1">⚠️ Cell Overlap Detected!</div>
                    <div>Cell: {overlapInfo.cellWidth.toFixed(1)} × {overlapInfo.cellHeight.toFixed(1)} μm</div>
                    <div>Pitch: {overlapInfo.dx} × {overlapInfo.dy} μm</div>
                    <div className="text-red-600 font-medium mt-1">
                      {overlapInfo.overlappingPairs.length} overlapping pair{overlapInfo.overlappingPairs.length > 1 ? 's' : ''}
                    </div>
                    {overlapInfo.overlappingPairs.slice(0, 3).map((pair, i) => (
                      <div key={i} className="text-red-600">
                        • Cell {pair.cell1} ↔ Cell {pair.cell2}
                      </div>
                    ))}
                    {overlapInfo.overlappingPairs.length > 3 && (
                      <div className="text-red-500">...and {overlapInfo.overlappingPairs.length - 3} more</div>
                    )}
                    <div className="mt-1 text-red-600 font-medium">Increase dx/dy or reduce cell size.</div>
                  </div>
                </div>
              )}
              
              {/* Array visualization */}
              {(() => {
                const xs = polygonPoints.map(p => p.x * 1e6);
                const ys = polygonPoints.map(p => p.y * 1e6);
                const cellXMin = Math.min(...xs);
                const cellXMax = Math.max(...xs);
                const cellYMin = Math.min(...ys);
                const cellYMax = Math.max(...ys);
                
                const cells: { x: number; y: number; col: number; row: number }[] = [];
                for (let row = 0; row < ecmParams.ny; row++) {
                  for (let col = 0; col < ecmParams.nx; col++) {
                    const xOffset = arrayArrangement === 'interlaced' && row % 2 === 1 
                      ? ecmParams.dx / 2 
                      : 0;
                    cells.push({
                      x: col * ecmParams.dx + xOffset,
                      y: row * ecmParams.dy,
                      col,
                      row,
                    });
                  }
                }
                
                const allCellsXs = cells.flatMap(c => [c.x + cellXMin, c.x + cellXMax]);
                const allCellsYs = cells.flatMap(c => [c.y + cellYMin, c.y + cellYMax]);
                const arrayXMin = Math.min(...allCellsXs);
                const arrayXMax = Math.max(...allCellsXs);
                const arrayYMin = Math.min(...allCellsYs);
                const arrayYMax = Math.max(...allCellsYs);
                const arrayWidth = arrayXMax - arrayXMin;
                const arrayHeight = arrayYMax - arrayYMin;
                
                const padding = Math.max(arrayWidth, arrayHeight) * 0.08;
                const viewSize = Math.max(arrayWidth, arrayHeight) + padding * 2;
                const centerX = (arrayXMin + arrayXMax) / 2;
                const centerY = (arrayYMin + arrayYMax) / 2;
                
                return (
                  <>
                    <div className="text-xs text-gray-500 mb-2">
                      <span>Width: {arrayWidth.toFixed(1)} μm</span>
                      <span className="mx-2">·</span>
                      <span>Height: {arrayHeight.toFixed(1)} μm</span>
                    </div>
                    <svg
                      viewBox={`${centerX - viewSize/2} ${centerY - viewSize/2} ${viewSize} ${viewSize}`}
                      className="w-full h-72 bg-gray-50 rounded border border-gray-200"
                      style={{ transform: 'scaleY(-1)' }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Axes */}
                      <line 
                        x1={centerX - viewSize/2} y1="0" 
                        x2={centerX + viewSize/2} y2="0" 
                        stroke="#e5e7eb" strokeWidth={viewSize * 0.002} 
                      />
                      <line 
                        x1="0" y1={centerY - viewSize/2} 
                        x2="0" y2={centerY + viewSize/2} 
                        stroke="#e5e7eb" strokeWidth={viewSize * 0.002} 
                      />
                      
                      {/* Array cells */}
                      {cells.map((cell, idx) => (
                        <g key={idx} transform={`translate(${cell.x}, ${cell.y})`}>
                          <polygon
                            points={polygonPoints.map(p => `${p.x * 1e6},${p.y * 1e6}`).join(' ')}
                            fill={cell.row % 2 === 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)'}
                            stroke={cell.row % 2 === 0 ? '#3b82f6' : '#22c55e'}
                            strokeWidth={viewSize * 0.003}
                          />
                          <circle cx="0" cy="0" r={viewSize * 0.008} fill="#666" />
                        </g>
                      ))}
                      
                      {/* dx dimension */}
                      {ecmParams.nx > 1 && (
                        <>
                          <line
                            x1={cells[0].x} y1={cells[0].y}
                            x2={cells[1].x} y2={cells[1].y}
                            stroke="#f97316" strokeWidth={viewSize * 0.006}
                            strokeDasharray={`${viewSize * 0.02} ${viewSize * 0.01}`}
                          />
                          <circle cx={cells[0].x} cy={cells[0].y} r={viewSize * 0.012} fill="#f97316" />
                          <circle cx={cells[1].x} cy={cells[1].y} r={viewSize * 0.012} fill="#f97316" />
                        </>
                      )}
                      
                      {/* dy dimension */}
                      {ecmParams.ny > 1 && (() => {
                        const startX = cells[0].x;
                        const startY = cells[0].y;
                        const endX = cells[0].x;
                        const endY = cells[0].y + ecmParams.dy;
                        return (
                          <>
                            <line
                              x1={startX} y1={startY}
                              x2={endX} y2={endY}
                              stroke="#8b5cf6" strokeWidth={viewSize * 0.006}
                              strokeDasharray={`${viewSize * 0.02} ${viewSize * 0.01}`}
                            />
                            <circle cx={startX} cy={startY} r={viewSize * 0.012} fill="#8b5cf6" />
                            <circle cx={endX} cy={endY} r={viewSize * 0.012} fill="#8b5cf6" />
                          </>
                        );
                      })()}
                      
                      {/* Origin */}
                      <circle cx="0" cy="0" r={viewSize * 0.01} fill="#ef4444" />
                    </svg>
                    
                    {/* Legend */}
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
                      <div className="flex items-center space-x-1 text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-sm bg-blue-200 border border-blue-500"></div>
                        <span>Even rows</span>
                      </div>
                      <div className="flex items-center space-x-1 text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-500"></div>
                        <span>Odd rows</span>
                      </div>
                      {ecmParams.nx > 1 && (
                        <div className="flex items-center space-x-1 text-orange-600 font-medium">
                          <div className="w-3 h-0.5 bg-orange-500 rounded"></div>
                          <span>dx={ecmParams.dx}μm</span>
                        </div>
                      )}
                      {ecmParams.ny > 1 && (
                        <div className="flex items-center space-x-1 text-purple-600 font-medium">
                          <div className="w-3 h-0.5 bg-purple-500 rounded"></div>
                          <span>dy={ecmParams.dy}μm</span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <div className="text-gray-400 text-sm">
                <div className="text-2xl mb-2">📐</div>
                <div className="font-medium text-gray-500">Array Preview</div>
                <div className="mt-1 text-xs">Define a shape to see the array layout</div>
              </div>
            </div>
          )}

          {/* Process Flow */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Process Flow</h3>
            <ol className="text-xs text-gray-600 space-y-1">
              <li>1. shape.txt → polygon file for ECM</li>
              <li>2. ECM calculates eigenmodes & eigenfreqs (from h_piezo, h_stru)</li>
              <li>3. ECM → output_power (frequency response)</li>
            </ol>
          </div>
        </div>
      </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          onClick={() => {
            updateState({ currentStep: 0 });
            navigate('/');
          }}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        
        <button
          onClick={handleSimulate}
          disabled={loading || !shapeFile}
          className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>{loading ? 'Simulating...' : 'Run Simulation'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
