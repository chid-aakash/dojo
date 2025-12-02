interface TimelineContextBulletinProps {
  lines: string[];
}

export default function TimelineContextBulletin({
  lines,
}: TimelineContextBulletinProps) {
  return (
    <div className="absolute left-0 w-full  backdrop-blur-sm text-green-400 font-mono px-4 py-2 border-gray-800 max-h-36 overflow-y-auto select-none top-[100px]">
      {lines.length === 0 ? (
        <p className="">// No tasks in this view</p>
      ) : (
        lines.map((line, idx) => (
          <p key={idx} className="leading-relaxed whitespace-pre text-sm">
            {`> ${line}`}
          </p>
        ))
      )}
    </div>
  );
}
