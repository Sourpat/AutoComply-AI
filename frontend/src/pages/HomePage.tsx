import React from "react";
import { Link } from "react-router-dom";
import "../styles/AutoComplyConsole.css";

export function HomePage() {
  return (
    <div className="ac-console">
      <header className="ac-console__topbar">
        <div>
          <h1 className="ac-console__title">AutoComply Console</h1>
          <p className="ac-console__subtitle">
            Sandbox for controlled substances, licenses, and mock orders – tuned for demos and interviews.
          </p>
        </div>

        <div className="ac-console__top-actions">
          <span className="ac-console__env-pill">Local Demo</span>
          <Link to="/console" className="ac-console__primary-btn">
            Run Guided Demo
          </Link>
        </div>
      </header>

      <div className="ac-console__layout">
        <div className="ac-console__left">
          <section className="ac-console__card ac-console__hero">
            <div className="ac-console__hero-header">
              <div>
                <h2>Ohio Hospital – Controlled Substance Suite</h2>
                <p>
                  Walk through CSF, license checks, and mock orders in one place. Designed for a 2–3 minute interview demo.
                </p>
              </div>
              <div className="ac-console__hero-badge">
                <span className="ac-console__hero-badge-dot" />
                Demo ready
              </div>
            </div>

            <div className="ac-console__hero-grid">
              <div>
                <p className="ac-console__metric-label">Engines</p>
                <p className="ac-console__metric-value">3</p>
                <p className="ac-console__metric-caption">CSF, License, Order</p>
              </div>
              <div>
                <p className="ac-console__metric-label">Sample journeys</p>
                <p className="ac-console__metric-value">4</p>
                <p className="ac-console__metric-caption">Happy, Missing TDDD, Non-Ohio, Needs review</p>
              </div>
              <div>
                <p className="ac-console__metric-label">Explainable traces</p>
                <p className="ac-console__metric-value">✔</p>
                <p className="ac-console__metric-caption">Toggle dev trace to show JSON</p>
              </div>
            </div>

            <div className="ac-console__hero-actions">
              <Link to="/console" className="ac-console__primary-btn">
                Open Ohio Hospital Journey
              </Link>
              <Link to="/csf" className="ac-console__ghost-btn">
                View CSF &amp; License Suite
              </Link>
            </div>
          </section>

          <section className="ac-console__card">
            <div className="ac-console__section-header">
              <h3>Highlighted journeys</h3>
              <span className="ac-console__section-pill">Interview ready</span>
            </div>

            <div className="ac-console__list">
              <div className="ac-console__list-item">
                <div>
                  <p className="ac-console__list-title">Ohio Hospital Order Journey</p>
                  <p className="ac-console__list-subtitle">
                    Show ok_to_ship vs needs_review vs blocked using Ohio TDDD + CSF + non-Ohio scenarios.
                  </p>
                </div>
                <Link to="/console" className="ac-console__chip-btn">
                  Open flow
                </Link>
              </div>

              <div className="ac-console__list-item">
                <div>
                  <p className="ac-console__list-title">NY Pharmacy License-Only Gate</p>
                  <p className="ac-console__list-subtitle">
                    License-only order gate driven by NY license rules. Show happy path and missing license flows.
                  </p>
                </div>
                <Link to="/license/ny-pharmacy" className="ac-console__chip-btn">
                  Open flow
                </Link>
              </div>

              <div className="ac-console__list-item">
                <div>
                  <p className="ac-console__list-title">Developer trace + docs</p>
                  <p className="ac-console__list-subtitle">
                    Turn on the dev trace and open the Docs &amp; Links section to show how APIs, architecture, and tests line up.
                  </p>
                </div>
                <Link to="/projects/autocomply-ai" className="ac-console__chip-btn">
                  Open docs
                </Link>
              </div>
            </div>
          </section>
        </div>

        <div className="ac-console__right">
          <section className="ac-console__card ac-console__stacked">
            <h3>Suites &amp; engines</h3>
            <div className="ac-console__pill-list">
              <Link to="/csf" className="ac-console__pill-btn">
                CSF Suite
              </Link>
              <Link to="/license" className="ac-console__pill-btn">
                License Suite
              </Link>
              <Link to="/console" className="ac-console__pill-btn">
                Order Sandbox
              </Link>
            </div>

            <div className="ac-console__mini-grid">
              <div className="ac-console__mini-card">
                <p className="ac-console__mini-label">CSF engines</p>
                <p className="ac-console__mini-value">5</p>
                <p className="ac-console__mini-caption">Practitioner, hospital, facility, EMS, researcher</p>
              </div>
              <div className="ac-console__mini-card">
                <p className="ac-console__mini-label">License engines</p>
                <p className="ac-console__mini-value">2</p>
                <p className="ac-console__mini-caption">Ohio TDDD, NY Pharmacy</p>
              </div>
            </div>
          </section>

          <section className="ac-console__card">
            <div className="ac-console__section-header">
              <h3>For interviews &amp; portfolio</h3>
            </div>
            <ul className="ac-console__bullet-list">
              <li>Each engine has its own API, decision model, and tests.</li>
              <li>
                Decisions normalize to <code>ok_to_ship</code>, <code>needs_review</code>, and <code>blocked</code>.
              </li>
              <li>
                Use this console with the architecture + case study docs when walking recruiters through the system.
              </li>
            </ul>
          </section>

          <section className="ac-console__card ac-console__stacked">
            <h3>Docs &amp; links</h3>
            <div className="ac-console__docs-grid">
              <Link to="/projects/autocomply-ai" className="ac-console__docs-btn">
                System architecture
              </Link>
              <Link to="/projects/autocomply-ai" className="ac-console__docs-btn">
                Portfolio case study
              </Link>
              <a
                href="https://github.com/Sourpat/AutoComply-AI/blob/main/scripts/smoke_test_autocomply.py"
                target="_blank"
                rel="noreferrer"
                className="ac-console__docs-btn"
              >
                Smoke test script
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
