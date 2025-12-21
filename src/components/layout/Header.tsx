// components/layout/Header.tsx

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="font-semibold text-xl text-neutral-900">
              Divinity<span className="text-primary-600">Coin</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/how-it-works"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/for-creators"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              For Creators
            </Link>
            <Link
              href="/faq"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              FAQ
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/balance">
              <Button variant="ghost" size="sm">
                Check Balance
              </Button>
            </Link>
            <Link href="/buy">
              <Button size="sm">Buy Credits</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <nav className="flex flex-col gap-4">
              <Link
                href="/how-it-works"
                className="text-neutral-600 hover:text-neutral-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                href="/for-creators"
                className="text-neutral-600 hover:text-neutral-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                For Creators
              </Link>
              <Link
                href="/faq"
                className="text-neutral-600 hover:text-neutral-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </Link>
              <hr className="border-neutral-200" />
              <Link href="/balance" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  Check Balance
                </Button>
              </Link>
              <Link href="/buy" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Buy Credits</Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
