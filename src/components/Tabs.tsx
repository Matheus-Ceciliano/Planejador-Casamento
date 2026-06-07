type Props = {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
};

export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
            active === tab
              ? 'bg-w-rose text-white shadow-rose'
              : 'bg-w-card text-w-muted shadow-soft hover:bg-w-surface hover:text-w-text'
          }`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
