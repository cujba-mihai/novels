export default function Resolve({ dimensions }: { dimensions?: string }) {
  return (
    <svg 
      className={`${dimensions || "novel-h-4 novel-w-4"
      } novel-fill-stone-600 novel-text-stone-200`}
      fill="#000000"
      width="800px"
      height="800px"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M17.28 9.28a.75.75 0 00-1.06-1.06l-5.97 5.97-2.47-2.47a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l6.5-6.5z" />
      <path fill-rule="evenodd" d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zM2.5 12a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0z" />
    </svg>
  );
}
