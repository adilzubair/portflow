export default function SettingsLoading() {
  return (
    <div className="space-y-5">
      <div className="px-1">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="skeleton h-[24rem] rounded-2xl" />
        <div className="skeleton h-[24rem] rounded-2xl" />
      </div>
    </div>
  );
}
