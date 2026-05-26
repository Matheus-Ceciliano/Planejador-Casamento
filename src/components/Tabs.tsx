type Props = {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
};

export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active === tab ? 'bg-ink text-white' : 'bg-white text-stone-600 hover:bg-rosew-50'}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
