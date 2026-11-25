import { useCapacityModel } from './hooks/useCapacityModel';
import { Header } from './components/Header';
import { StartPeriod } from './components/StartPeriod';
import { ParamCard } from './components/ParamCard';
import { CapacityChart } from './components/CapacityChart';
import { SummaryCards } from './components/SummaryCards';
import { AlertBanner } from './components/AlertBanner';
import { MonthlyTable } from './components/MonthlyTable';
import { PARAM_ORDER } from './data/defaults';

export default function App() {
  const model = useCapacityModel();
  const { state, summary } = model;

  const handleReset = () => {
    const confirmed = window.confirm(
      'Clear all settings and return to the baseline scenario? Data in localStorage will be removed.',
    );
    if (confirmed) model.resetAll();
  };

  return (
    <div className="app">
      <Header
        horizonYears={state.horizonYears}
        scenarioId={state.scenarioId}
        onHorizonChange={model.setHorizon}
        onPreset={model.applyPreset}
        onReset={handleReset}
      />

      <div className="layout">
        <section className="panel" aria-label="Model parameters">
          <StartPeriod
            startYear={state.startYear}
            startMonth={state.startMonth}
            onChange={model.setStart}
          />

          {PARAM_ORDER.map((key) => (
            <ParamCard
              key={key}
              paramKey={key}
              param={state[key]}
              startYear={state.startYear}
              startMonth={state.startMonth}
              horizonYears={state.horizonYears}
              onBase={(value) => model.setBase(key, value)}
              onMode={(mode) => model.setMode(key, mode)}
              onStep={(value) => model.setStep(key, value)}
              onAddEvent={() => model.addEvent(key)}
              onUpdateEvent={(id, patch) => model.updateEvent(key, id, patch)}
              onRemoveEvent={(id) => model.removeEvent(key, id)}
            />
          ))}
        </section>

        <section className="results" aria-label="Results">
          <CapacityChart
            points={model.chartPoints}
            prefs={state.chartPrefs}
            isYearly={model.isYearly}
            seatsMode={state.seats.mode}
            crossing={model.crossing}
            onToggle={model.toggleChartLine}
          />
          <SummaryCards summary={summary} />
          <AlertBanner summary={summary} />
          <MonthlyTable points={model.points} crossingIndex={summary.crossingIndex} />
        </section>
      </div>

      <footer className="app-footer">
        <span>Office capacity model</span>
        <span>MVP · all data stays in your browser · no network requests</span>
      </footer>
    </div>
  );
}