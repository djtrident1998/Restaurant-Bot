// Shown the instant someone taps "Order", while the server prepares the page (a cold start can take a second or two).
// Without this the screen sits unchanged and the button feels broken.
export default function Loading() {
  return (
    <div className="flex h-dvh flex-col" role="status" aria-label="Loading the ordering page">
      <div className="h-16 border-b border-line bg-panel/90" />
      <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col gap-3 px-3 py-3 sm:px-5 lg:grid lg:grid-cols-[224px_minmax(0,1fr)_330px] lg:gap-4 lg:pt-4">
        <div className="card hidden animate-pulse p-4 lg:block">
          <div className="h-3 w-16 rounded bg-line" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 rounded-xl bg-line/70" />
            ))}
          </div>
        </div>
        <div className="card flex min-h-0 flex-1 animate-pulse flex-col gap-4 p-5">
          <div className="h-6 w-2/3 rounded bg-line" />
          <div className="h-4 w-1/2 rounded bg-line/70" />
          <div className="mt-2 flex gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 w-16 rounded-full bg-line/70" />
            ))}
          </div>
          <div className="mt-auto h-11 rounded-full bg-line/70" />
        </div>
        <div className="card hidden animate-pulse p-4 lg:block">
          <div className="h-5 w-24 rounded bg-line" />
          <div className="mt-6 h-24 rounded-xl bg-line/60" />
        </div>
      </div>
      <p className="pb-4 text-center text-sm text-muted">Setting your table…</p>
    </div>
  );
}
