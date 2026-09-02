import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { TERMS_HTML } from '../lib/legalContent';
import LegalDocument from '../components/LegalDocument';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">Terms of Use</h1>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-6 text-sm">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          <strong>Draft for review — not yet approved.</strong> This document has not been
          reviewed by a South African attorney. Sections in{' '}
          <span className="bg-amber-200/70 px-1 rounded font-mono text-xs">highlighted brackets</span>{' '}
          below depend on the Company's formal registration and are intentionally left blank
          until then.
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
        <LegalDocument html={TERMS_HTML} />
      </div>
    </div>
  );
}
