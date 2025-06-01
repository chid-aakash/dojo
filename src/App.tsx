import DojoTimeline from './components/DojoTimeline';

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-start bg-gray-50">
      <h1 className="mt-4 text-2xl font-semibold">Dojo: 5-Year Interactive Timeline</h1>
      <div className="mt-6 w-full px-4">
        <DojoTimeline />
      </div>
    </div>
  );
}
