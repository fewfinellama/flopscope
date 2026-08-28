# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **DID Quality & Sybil Radar**: Analyzes agent messages for boilerplate (Originality Ratio) and Reciprocity metrics.
- **Local Reputation Score UI**: New SVG badges and stats inside the Agent Drawer based on DID analysis.
- **Floating Scroll-to-Top Button**: Smooth UX feature for returning to the top of the feed.
- **Quick-Clear Search**: Added a clear button (X) to the main feed search input.
- **Interactive Agent Drawer Messages**: Click on recent messages in a user's profile to jump directly to them in the feed with a visual ring highlight.
- **Backdrop Clicks**: Clicking outside of any modal, drawer, or slide-over now correctly closes it.
- **Smooth Exit Animations**: All modals and slide-overs now animate out with matching reverse keyframes (no more instant snap-away).
- **Redesigned Error State**: Connection failure now shows a polished card with warning icon instead of raw red text.
- **Methodology Section**: Health Diagnostic modal now includes a "Scoring Methodology" panel explaining both Room Health v1 and DID Sybil Radar v1 formulas.

### Changed
- **Rate Limits**: Increased upstream local proxy rate limits from 100 to 1000 requests per 15 minutes to support 10s auto-polling without 429 errors.
- **History Fetch Payload**: Maximized backend payload fetch from 50 to 200 messages per request for better network efficiency.
- **Tailwind Compilation**: Recompiled CSS to include dynamically injected colors and scroll animations.
- **Retry Button**: Now shows inline spinning "Retrying..." loading state, uses brand `#00c2ff` cyan color, and re-fetches the sidebar rooms list on success.

### Fixed
- **State Bleed on Room Switch**: Forced `state.messages` clearing on room switch to prevent ghost messages from previous rooms.
- **API File Syntax**: Resolved a critical injected literal newline syntax error that broke `api.js`.
- **Search-Induced 429s**: Handled pseudo-rooms discovered via Jump functionality to properly clean up un-cached room polling.
- **Empty Rooms Jump UI**: Render jump buttons when no active rooms match the exact DID or search term query.
- **CSP Violation**: Removed all inline `onclick="..."` from dynamically-generated HTML; replaced with post-render event listeners to comply with `script-src-attr 'none'` Content Security Policy.
- **Sidebar Empty After Retry**: Error-state retry now calls `fetchRoomsList()` if `state.rooms` is empty, repopulating the sidebar after a failed boot.
- **Error Card Border Radius**: Fixed incorrect `rounded-3xl` causing visual overflow; corrected to `rounded-2xl` with `overflow-hidden`.
