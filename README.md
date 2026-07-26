<div align="center">

AI Trading Journal

Turn every trade into structured data, measurable performance, and actionable insight.



View Live Application · Report a Bug · Request a Feature

</div>

Overview

AI Trading Journal is a privacy-first, browser-based workspace for recording trades, measuring performance, reviewing execution quality, and learning from trading behavior.

The application combines structured trade management, automatic PNL calculations, live cryptocurrency prices, performance charts, calendar analytics, screenshot evidence, multilingual support, and optional AI-assisted trade reviews—all without requiring an account or backend for its core functionality.

Built as a portfolio project focused on modular front-end architecture, external API integrations, client-side persistence, data visualization, responsive design, and AI-assisted workflows.

Product Highlights

Local-first: trading records remain in the user's browser.

Actionable analytics: PNL, win rate, profit factor, average win/loss, and monthly results.

Live context: current cryptocurrency prices and market news.

AI-assisted review: optional analysis through a configurable Groq endpoint.

Visual evidence: attach and organize screenshots for every trade.

Multilingual: English, Ukrainian, Czech, and Russian interfaces.

Responsive: optimized for phones, tablets, laptops, and wide displays.

Portable data: JSON and CSV export with JSON import support.

Features

Trade Management

Record open and closed positions

Support LONG and SHORT trade directions

Track entry price, exit price, deposit, position size, and date

Capture entry and exit reasoning

Record emotional state and post-trade lessons

Close, edit, analyze, and remove journal entries

Automatically persist changes between browser sessions

Performance Analytics

Automatic PNL calculation in USD and percentage

Win-rate, profit-factor, average-win, and average-loss metrics

Responsive equity curve

Monthly PNL visualization

Monthly performance aggregation

Separate open and closed trade views

Trading Calendar

Monthly and yearly calendar modes

Daily PNL indicators

Positive and negative trading-day states

Trade counts and compact day summaries

Responsive calendar layout for mobile devices

Market and AI Integrations

Live cryptocurrency prices from the Binance public API

Price and news context from CryptoCompare

Optional Groq-powered trade analysis

Configurable OpenAI-compatible endpoint and model

Czech Radio Kiss stream for the built-in audio experience

Screenshot Workflow

Upload multiple images

Paste screenshots directly from the clipboard

Automatic browser-side image optimization

Trade-level screenshot previews

Central screenshot library

Full-screen image viewer

Data Portability

Export the full journal as JSON

Restore journal data from a JSON backup

Export closed trades as CSV

No proprietary data format or account lock-in

Responsive Design

The interface uses progressive responsive breakpoints and adapts its navigation, typography, forms, statistics, tables, charts, calendars, galleries, and modals to the available screen.

Device class

Layout behavior

Wide desktop

Full navigation, multi-column forms, four-column KPI dashboard

Laptop

Compact spacing and navigation

Tablet

Two-column forms and KPIs, stacked analytics

Mobile

Single-column forms, touch controls, scrollable data tables

Small mobile

Simplified header, full-width actions, compact calendar

Landscape mobile

Height-aware hero and scrollable dialogs

Additional support includes:

safe-area spacing for modern mobile devices;

44 px minimum touch targets;

iOS input zoom prevention;

responsive high-DPI Canvas rendering;

reduced-motion accessibility preferences;

touch-specific interaction behavior;

printable journal overview.

Architecture

flowchart TD
    UI["Responsive UI"] --> APP["Application Controller"]
    APP --> TRADES["Trade Management"]
    APP --> ANALYTICS["Analytics Engine"]
    APP --> CALENDAR["Calendar & Charts"]
    TRADES --> STORAGE["Local Storage"]
    APP --> SERVICES["External Services"]
    SERVICES --> MARKET["Market APIs"]
    SERVICES --> AI["Optional Groq AI"]

Module Responsibilities

Module

Responsibility

app.js

Application initialization, theme, language, and responsive chart updates

trades.js

Trade lifecycle, table rendering, and user actions

analytics.js

Pure PNL, KPI, and monthly aggregation functions

calendar.js

Monthly/yearly calendar rendering

charts.js

Equity and monthly PNL Canvas visualizations

storage.js

Browser persistence abstraction

market-api.js

Price and market-data requests

ai-service.js

AI configuration and trade-analysis workflow

screenshots.js

Image processing, preview, and attachment handling

export-import.js

JSON/CSV portability

validation.js

Trade-input validation

i18n.js

English, Ukrainian, Czech, and Russian translations

radio-visualizer.js

Radio playback and animated background

Technology Stack

Area

Technology

Front end

HTML5, CSS3, Vanilla JavaScript

Styling

CSS custom properties, Grid, Flexbox, media queries

Persistence

Web Storage API

Visualization

HTML Canvas API

Market data

Binance Public API, CryptoCompare API

AI

Groq API through an OpenAI-compatible endpoint

Testing

Jest

Deployment

GitHub Pages

Project Structure

ai-trading-journal/
├── src/
│   ├── css/
│   │   ├── variables.css
│   │   ├── base.css
│   │   ├── components.css
│   │   └── responsive.css
│   └── js/
│       ├── ai-service.js
│       ├── analytics.js
│       ├── app.js
│       ├── calendar.js
│       ├── charts.js
│       ├── export-import.js
│       ├── i18n.js
│       ├── market-api.js
│       ├── radio-visualizer.js
│       ├── screenshots.js
│       ├── storage.js
│       ├── trades.js
│       └── validation.js
├── tests/
│   └── analytics.test.js
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── LICENSE

Getting Started

Prerequisites

A modern browser

Node.js 20+ only if you want to run the automated tests

Run Locally

git clone https://github.com/tetiana-a/ai-trading-journal.git
cd ai-trading-journal

The application has no production build step. Serve the directory with any static server:

python -m http.server 8000

Open:

http://localhost:8000

You can also open index.html directly, although a local server provides more consistent browser behavior for external integrations.

Testing

Install the development dependency and run the complete unit-test suite:

npm ci
npm test

Current coverage scope:

profitable and losing LONG trades;

profitable and losing SHORT trades;

open and incomplete trades;

string and numeric inputs;

aggregate performance statistics;

profit factor and average results;

monthly grouping and filtering.

Current result: 21 tests passing.

AI Configuration

AI review is optional; all core journal features work without an API key.

Create an API key at console.groq.com/keys.

Open the application settings.

Enter the API URL, key, and supported model name.

Save the configuration.

Select the AI action for a recorded trade.

Default configuration:

API URL: https://api.groq.com/openai/v1/chat/completions
Model:   llama-3.3-70b-versatile

Security note: Never commit an API key to GitHub. This static application stores user-provided AI settings locally in the browser. A multi-user production version should place secrets behind a secured backend or serverless proxy.

Data and Privacy

Trade records are stored locally in the current browser.

The project does not include authentication or a centralized database.

Clearing browser data may remove saved trades.

Screenshots consume browser-storage capacity.

AI review sends relevant trade context to the configured AI provider.

Market requests are sent to their respective third-party APIs.

Use JSON export regularly to maintain an independent backup.

Engineering Decisions

Framework-free core: minimizes runtime dependencies and keeps GitHub Pages deployment simple.

Modular JavaScript: separates UI, domain calculations, storage, integrations, and visualization.

Pure analytics functions: makes financial calculations deterministic and unit-testable.

Local-first persistence: enables immediate use without onboarding or account creation.

Progressive integrations: market and AI services enhance the journal without blocking its core workflow.

Responsive-by-design: adapts complex trading data to touch devices without removing desktop functionality.

Roadmap

Move screenshot persistence from localStorage to IndexedDB

Add strategy tags and advanced filtering

Add risk-to-reward and expectancy analytics

Add maximum drawdown and streak analysis

Add automated accessibility testing

Add end-to-end browser tests

Add optional authentication and encrypted cloud synchronization

Add a secure serverless proxy for AI requests

Add Progressive Web App support

Disclaimer

AI Trading Journal is an educational and analytical tool. It does not execute trades and does not provide financial, investment, or trading advice. Users remain solely responsible for their trading decisions and risk management.

Contributing

Contributions and constructive feedback are welcome.

git checkout -b feature/your-feature
git commit -m "feat: describe your change"
git push origin feature/your-feature

Then open a pull request with a clear description and testing notes.

License

Distributed under the MIT License.

Author

Tetiana KotolupAI Automation Developer · Full-Stack Development · API Integrations



<div align="center">

Built with a focus on disciplined execution, measurable improvement, and thoughtful user experience.

⭐ If you find this project useful, consider starring the repository.

</div>
