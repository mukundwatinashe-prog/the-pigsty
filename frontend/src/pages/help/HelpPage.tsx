import { Bot, Database, Shield, Server, MonitorCheck } from 'lucide-react';

const implementationPhases = [
  {
    title: 'Phase 1: Foundation Setup',
    points: [
      'Finalize dependencies and environment configuration for backend and frontend.',
      'Create project structure for chat modules, services, and UI components.',
    ],
  },
  {
    title: 'Phase 2: Backend Implementation',
    points: [
      'Implement chat routes, controllers, AI provider integration, and conversation persistence.',
      'Apply auth checks, rate limiting, validation, and centralized error handling.',
    ],
  },
  {
    title: 'Phase 3: Frontend Implementation',
    points: [
      'Build chat UI components and state management for conversations and messages.',
      'Integrate API service for create/load/send/update/delete chat operations.',
    ],
  },
  {
    title: 'Phase 4: Integration and Testing',
    points: [
      'Verify end-to-end chat flow across auth, API, AI providers, and persistence.',
      'Add API and UI test coverage for key success and failure paths.',
    ],
  },
  {
    title: 'Phase 5: Deployment',
    points: [
      'Promote environment settings, migrate database, and validate production routes.',
      'Enable monitoring, logging, and operational runbooks for support.',
    ],
  },
];

const architectureCards = [
  {
    title: 'Frontend (React)',
    icon: Bot,
    description:
      'A chat widget in the app shell with message list, input, conversation history, and persistence-aware state.',
  },
  {
    title: 'Backend (Node/Express)',
    icon: Server,
    description:
      'Authenticated chat endpoints, provider-agnostic AI service layer, and middleware for validation, limits, and errors.',
  },
  {
    title: 'Database (PostgreSQL)',
    icon: Database,
    description:
      'Stores conversations, messages, users, and usage logs with indexes for fast history and analytics queries.',
  },
];

const securityPoints = [
  'Use JWT authentication and enforce per-user conversation ownership checks.',
  'Apply request and usage rate limits to protect AI endpoints.',
  'Validate and sanitize input payloads before persistence/provider calls.',
  'Avoid leaking stack traces in production responses.',
  'Keep provider keys in environment variables only.',
];

const monitoringPoints = [
  'Track API latency, AI provider latency, and error rates.',
  'Track message volume, token usage, and estimated cost over time.',
  'Log failures with enough context for debugging but without sensitive data.',
  'Review usage and cost trends weekly for optimization opportunities.',
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="rounded-2xl border border-primary-200 bg-primary-50/50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          AI Help Feature
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Implementation Reference</h1>
        <p className="mt-2 text-sm text-gray-700">
          This page holds the implementation blueprint for the in-app AI Help experience across
          React, Node/Express, and PostgreSQL.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Architecture Overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {architectureCards.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex rounded-xl bg-gray-100 p-2 text-gray-700">
                <Icon className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Implementation Phases</h2>
        <div className="mt-4 space-y-4">
          {implementationPhases.map((phase) => (
            <article key={phase.title} className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">{phase.title}</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {phase.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-2 inline-flex rounded-xl bg-amber-100 p-2 text-amber-700">
            <Shield className="size-5" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Security Checklist</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {securityPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-2 inline-flex rounded-xl bg-emerald-100 p-2 text-emerald-700">
            <MonitorCheck className="size-5" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Monitoring and Maintenance</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {monitoringPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
