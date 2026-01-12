import React from "react";
import { Link } from "react-router-dom";

interface AudienceCard {
  title: string;
  description: string;
  linkText: string;
  linkTo: string;
  isExternal?: boolean;
}

const audienceCards: AudienceCard[] = [
  {
    title: "Compliance teams",
    description: "Review submissions and manage verification workflows",
    linkText: "Compliance Console",
    linkTo: "/console",
  },
  {
    title: "Product & engineering",
    description: "Explore API endpoints, models, and integration patterns",
    linkText: "System architecture",
    linkTo: "/projects/autocomply-ai",
  },
  {
    title: "Leadership",
    description: "Understand the business case and technical capabilities",
    linkText: "Portfolio case study",
    linkTo: "/projects/autocomply-ai",
  },
  {
    title: "Recruiters",
    description: "See working code, tests, and deployment readiness",
    linkText: "Smoke test script",
    linkTo: "https://github.com/Sourpat/AutoComply-AI/blob/main/scripts/smoke_test_autocomply.py",
    isExternal: true,
  },
];

export function AudiencePaths() {
  return (
    <section className="ac-console__card">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900">Who is this for?</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {audienceCards.map((card, index) => (
          <div
            key={index}
            className="border-2 border-slate-200 rounded-xl p-6 flex flex-col hover:border-cyan-300 transition-all"
          >
            <h4 className="text-lg font-bold text-slate-900 mb-3">
              {card.title}
            </h4>
            <p className="text-base text-slate-700 mb-4 flex-1 leading-relaxed">
              {card.description}
            </p>
            {card.isExternal ? (
              <a
                href={card.linkTo}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
              >
                {card.linkText} →
              </a>
            ) : (
              <Link
                to={card.linkTo}
                className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
              >
                {card.linkText} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
