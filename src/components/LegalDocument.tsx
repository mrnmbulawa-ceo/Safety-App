import React from 'react';

/**
 * Renders a static legal document (Terms of Use / Privacy Policy) that we
 * generate and control ourselves — never user-submitted content — so
 * dangerouslySetInnerHTML is safe here. Styled directly (rather than via
 * Tailwind's `prose` class) since @tailwindcss/typography isn't installed
 * in this project.
 */
export default function LegalDocument({ html }: { html: string }) {
  return (
    <>
      <div className="ube-legal" dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        .ube-legal-masthead p {
          margin: 0 0 0.4rem 0;
          color: #475569;
          font-size: 0.8rem;
        }
        .ube-legal-masthead p:first-child,
        .ube-legal-masthead p:nth-child(2) {
          font-size: 1.1rem;
          font-weight: 800;
          color: #1e293b;
        }
        .ube-legal-masthead {
          padding-bottom: 1.25rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .ube-legal h2 {
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
          margin: 2rem 0 0.75rem 0;
        }
        .ube-legal p {
          font-size: 0.875rem;
          line-height: 1.65;
          color: #334155;
          margin: 0 0 0.9rem 0;
        }
        .ube-legal ul {
          margin: 0 0 1rem 0;
          padding-left: 1.25rem;
          list-style: disc;
        }
        .ube-legal li {
          font-size: 0.875rem;
          line-height: 1.6;
          color: #334155;
          margin-bottom: 0.5rem;
        }
        .ube-legal li p { margin: 0; }
        .ube-legal blockquote {
          border-left: 3px solid #dc2626;
          background: #fef2f2;
          padding: 0.75rem 1rem;
          margin: 0 0 1rem 0;
          border-radius: 0 0.375rem 0.375rem 0;
        }
        .ube-legal blockquote p {
          color: #991b1b;
          margin: 0;
        }
        .ube-legal strong { color: #1e293b; }
        .ube-legal .ube-placeholder {
          background: #fef3c7;
          color: #92400e;
          padding: 0 0.25rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, monospace;
          font-size: 0.8em;
        }
      `}</style>
    </>
  );
}
