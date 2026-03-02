import Plot from 'react-plotly.js';

interface VibrationPlotProps {
  x: number[];
  y: number[];
  displacement: number[];
  frequency: number;
}

export default function VibrationPlot({ x, y, displacement, frequency }: VibrationPlotProps) {
  const freqLabel =
    frequency >= 1e6
      ? `${(frequency / 1e6).toFixed(2)} MHz`
      : frequency >= 1e3
      ? `${(frequency / 1e3).toFixed(1)} kHz`
      : `${frequency.toFixed(0)} Hz`;

  const data: Plotly.Data[] = [
    {
      x,
      y,
      mode: 'markers',
      type: 'scatter',
      marker: {
        color: displacement,
        colorscale: 'Turbo',
        size: 4,
        colorbar: {
          title: 'Displacement',
          thickness: 15,
          len: 0.9,
        },
      },
      text: displacement.map(
        (d, i) => `x: ${x[i].toFixed(1)}<br>y: ${y[i].toFixed(1)}<br>disp: ${d.toExponential(3)}`
      ),
      hoverinfo: 'text',
    } as any,
  ];

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: `2D Vibration @ ${freqLabel}`,
      font: { size: 14 },
    },
    xaxis: {
      title: { text: 'X' },
      scaleanchor: 'y',
      scaleratio: 1,
      gridcolor: '#e5e7eb',
      showticklabels: false,
    },
    yaxis: {
      title: { text: 'Y' },
      gridcolor: '#e5e7eb',
      showticklabels: false,
    },
    margin: { t: 50, r: 30, b: 40, l: 40 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'white',
    showlegend: false,
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
        style={{ height: '450px' }}
      />
    </div>
  );
}
