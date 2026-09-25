import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full py-16 border-t border-zinc-800 bg-zinc-950 text-zinc-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Brand & Service Area */}
          <div className="flex flex-col items-start gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
                EA
              </div>
              <span className="font-bold text-lg text-white">E-Ambulance</span>
            </Link>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Real-time emergency medical dispatch platform serving Raiganj, Sudarshanpur, NH-34 corridor, and surrounding Uttar Dinajpur.
            </p>
            <div className="text-[11px] text-zinc-500">
              Operational Status: <span className="text-emerald-400 font-semibold">● 24/7 Live</span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div className="flex flex-col items-start gap-3 text-sm">
            <p className="font-bold text-white text-xs uppercase tracking-wider mb-1">
              Navigation
            </p>
            <Link href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="#fleet" className="hover:text-white transition-colors">
              Fleet Options
            </Link>
            <Link href="#hospitals" className="hover:text-white transition-colors">
              Hospital Directory
            </Link>
            <Link href="#emergency" className="hover:text-white transition-colors">
              Emergency Hotlines
            </Link>
          </div>

          {/* Col 3: System Portals */}
          <div className="flex flex-col items-start gap-3 text-sm">
            <p className="font-bold text-white text-xs uppercase tracking-wider mb-1">
              Portals
            </p>
            <Link href="/user/book" className="text-red-400 hover:text-red-300 transition-colors font-medium">
              Book Ambulance
            </Link>
            <Link href="/auth/login" className="hover:text-white transition-colors">
              Patient Portal Sign In
            </Link>
            <Link href="/auth/login?role=driver" className="hover:text-white transition-colors">
              Ambulance Driver Console
            </Link>
            <Link href="/auth/register" className="hover:text-white transition-colors">
              Create New Account
            </Link>
            <Link href="/auth/login?role=admin" className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors">
              Hospital Admin Login
            </Link>
          </div>

          {/* Col 4: Emergency Contacts */}
          <div className="flex flex-col items-start gap-3 text-sm">
            <p className="font-bold text-white text-xs uppercase tracking-wider mb-1">
              Emergency Contacts
            </p>
            <p className="text-xs text-zinc-400">
              National Emergency: <a href="tel:108" className="text-red-400 font-bold hover:underline">108</a>
            </p>
            <p className="text-xs text-zinc-400">
              Pregnancy / Mother Care: <a href="tel:102" className="text-red-400 font-bold hover:underline">102</a>
            </p>
            <p className="text-xs text-zinc-400">
              Police Control Room: <a href="tel:100" className="text-zinc-200 hover:underline">100</a>
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Raiganj District Hospital Casualty: Available round the clock
            </p>
          </div>
        </div>

        {/* Bottom Sub-Bar */}
        <div className="pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} E-Ambulance Raiganj. Emergency Medical Transport System.</p>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="hover:text-zinc-400">
              Sign In
            </Link>
            <Link href="/auth/register" className="hover:text-zinc-400">
              Register
            </Link>
            <a href="tel:108" className="text-red-500 hover:underline font-semibold">
              Emergency: 108
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
