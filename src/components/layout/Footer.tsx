// components/layout/Footer.tsx

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="font-semibold text-lg text-white">
                DivinityCoin
              </span>
            </div>
            <p className="text-sm">
              The universal currency for supporting creators across the web.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/buy"
                  className="hover:text-white transition-colors"
                >
                  Buy Credits
                </Link>
              </li>
              <li>
                <Link
                  href="/redeem"
                  className="hover:text-white transition-colors"
                >
                  Redeem Code
                </Link>
              </li>
              <li>
                <Link
                  href="/balance"
                  className="hover:text-white transition-colors"
                >
                  Check Balance
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="hover:text-white transition-colors"
                >
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/for-creators"
                  className="hover:text-white transition-colors"
                >
                  For Creators
                </Link>
              </li>
              <li>
                <Link
                  href="/developers"
                  className="hover:text-white transition-colors"
                >
                  Developers
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="hover:text-white transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="hover:text-white transition-colors"
                >
                  Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/refunds"
                  className="hover:text-white transition-colors"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm">
            © {new Date().getFullYear()} DivinityCoin. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {/* Visa */}
            <div className="w-10 h-6 bg-white rounded flex items-center justify-center">
              <span className="text-[#1A1F71] text-xs font-bold">VISA</span>
            </div>
            {/* Mastercard */}
            <div className="w-10 h-6 bg-neutral-800 rounded flex items-center justify-center relative overflow-hidden">
              <div className="absolute w-4 h-4 bg-[#EB001B] rounded-full left-1" />
              <div className="absolute w-4 h-4 bg-[#F79E1B] rounded-full right-1" />
            </div>
            {/* Stripe badge */}
            <span className="text-xs">Powered by Stripe</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
