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
      <div className="ac-console__section-header mb-6">
        <h3>Who is this for?</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {audienceCards.map((card, index) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col"
          >
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              {card.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1">
              {card.description}
            </p>
            {card.isExternal ? (
              <a
                href={card.linkTo}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {card.linkText} →
              </a>
            ) : (
              <Link
                to={card.linkTo}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
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
