export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-[22rem] rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-72 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-[28rem] rounded-2xl" />
    </div>
  );
}
