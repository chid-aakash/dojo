import DojoTimeline from './components/DojoTimeline';

export default function App() {
  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col">
      <header className="p-6">
        <h1 className="text-3xl font-bold text-white">Dojo</h1>
      </header>
      <div className="flex-1 px-6 pb-6">
        <DojoTimeline />
      </div>
    </div>
  );
}
