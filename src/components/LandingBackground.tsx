/**
 * The landing page's moving backdrop.
 *
 * Three soft colour fields drifting on different cycles over a light base, plus
 * a dot lattice. Pure CSS transforms, so it costs no JavaScript and stops
 * entirely under `prefers-reduced-motion`.
 */
export default function LandingBackground() {
  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 overflow-hidden'>
      <div className='absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-sky-50' />

      <div className='animate-drift-a motion-reduce:animate-none absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-emerald-300/40 blur-3xl' />
      <div className='animate-drift-b motion-reduce:animate-none absolute -right-40 top-1/3 h-[34rem] w-[34rem] rounded-full bg-sky-300/40 blur-3xl' />
      <div className='animate-drift-c motion-reduce:animate-none absolute -bottom-48 left-1/4 h-[30rem] w-[30rem] rounded-full bg-violet-300/30 blur-3xl' />

      <div className='landing-grid absolute inset-0' />
    </div>
  )
}
