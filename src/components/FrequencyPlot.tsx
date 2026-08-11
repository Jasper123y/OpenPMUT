import Plot from 'react-plotly.js';

interface FrequencyPlotProps {
  frequencies: number[];
  powerDb: number[];
  peaks?: Array<{ frequency: number; power: number }>;
}

export default function FrequencyPlot({ frequencies, powerDb, peaks }: FrequencyPlotProps) {
  const data: Plotly.Data[] = [
    {
      x: frequencies,
      y: powerDb,
      type: 'scatter',
      mode: 'lines',
      name: 'Power Response',
      line: { color: '#3b82f6', width: 2 },
    },
  ];

  if (peaks && peaks.length > 0) {
    data.push({
      x: peaks.map(p => p.frequency),
      y: peaks.map(p => p.power),
      type: 'scatter',
      mode: 'markers',
      name: 'Resonance Peaks',
      marker: { color: '#ef4444', size: 10, symbol: 'diamond' },
    });
  }

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: 'Frequency Response',
      font: { size: 16 },
    },
    xaxis: {
      title: { text: 'Frequency (Hz)' },
      type: 'log',
      gridcolor: '#e5e7eb',
    },
    yaxis: {
      title: { text: 'Power (dB)' },
      gridcolor: '#e5e7eb',
    },
    showlegend: true,
    legend: {
      x: 1,
      xanchor: 'right',
      y: 1,
    },
    margin: { t: 50, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'white',
  };

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  };

  return (
    <div className="w-full">
      <Plot
        data={data}
        layout={layout}
        config={config}
        className="w-full"
        style={{ height: '400px' }}
      />
    </div>
  );
}
