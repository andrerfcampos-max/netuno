# Product Specification: Super Argos 2.1 (Netuno)

## 1. Product Overview
- **Product Name:** Super Argos 2.1 (Netuno)
- **Tagline:** Mobile-First Tactical Command Center & Hydrant Management PWA for Military Firefighters (CBMDF)
- **Production URL:** https://netuno-eight.vercel.app/
- **Repository:** https://github.com/andrerfcampos-max/netuno
- **Description:**  
  Super Argos 2.1 is an offline-capable, mobile-first Progressive Web Application (PWA) designed for emergency responders and tactical fire crews of the Military Fire Brigade (CBMDF). It provides real-time geographic inspection, route planning (Traveling Salesperson Problem optimization), status tracking, maintenance reporting, and analytical dashboards for thousands of public fire hydrants across the Federal District.

---

## 2. Goals & Objectives
- **Zero-Friction Field Vetting:** Enable rapid 2-to-3 touch technical inspections under extreme field conditions (bright sunlight, movement, high glare).
- **Tactical Navigation & Route Optimization:** Automate route sequencing (TSP via Haversine formula) for fire crew missions with direct integration to Waze, Google Maps, and Street View.
- **Strict Data Sanitization & Standardization:** Eliminate free-text errors through a parameterized 33-item standardized failure catalog and automated coordinate parsing.
- **State Decoupling & High Performance:** Seamlessly manage >5,000 geospatial entities on Leaflet satellite hybrid maps without memory leaks, lag, or loss of mission state during filtering.
- **Auditability & Offline Reliability:** Preserve an immutable inspection history and provide live CSV/PDF export and PWA caching.

---

## 3. Target Users
- **Tactical Fire Crews & Field Inspectors:** Military firefighters performing daily field inspections and operational hydrant verifications in emergency vehicles.
- **Battalion Command & Logistics Officers:** Commanders analyzing regional hydrant availability, maintenance backlogs, and operational readiness.
- **Hydrant Maintenance Teams (Public Water Utility - CAESB / CBMDF):** Technicians receiving structured fault reports to schedule valve, pipe, or cap repairs.

---

## 4. Core Features

### 4.1. Interactive Tactical Map (`MapComponent`)
- **Hybrid Satellite Layer:** Exclusively uses Google Hybrid Satellite tiles (`http://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}`) for maximum contrast in sunlight.
- **Pure CSS High-Contrast Markers (`L.divIcon`):**
  - Operable Hydrant: Neon Green (`#00FF00`) circle with a 2px solid white border.
  - Inoperable Hydrant: Neon Red (`#FF0000`) circle with a 2px solid white border.
  - Mission-Selected Hydrant: Cyan glowing ring (`#00FFFF`) and numbered badge.
- **Dynamic Conditional Clustering:** Activates `MarkerClusterGroup` only when rendering >500 hydrants to keep small mission routes distinctly visible.
- **Strict Layout Stability:** CSS-enforced container dimensions (`h-[55vh]` to `h-[60vh]`) preventing map collapse or blank screen issues.

### 4.2. Tactical Hydrant Popup & Navigation Links
- **Immutable Details Display:** Always displays Hydrant ID (`codHidrante` / `nomHidrante`), Operational Status, Full Address, Reference Point, Administrative Region (RA), Coordinates, and Timestamp of the Last Inspection (`datHoraUltimaVistoria`).
- **External Navigation Integrations:**
  - One-tap Waze navigation dispatch (`https://waze.com/ul?ll={lat},{long}&navigate=yes`).
  - One-tap Google Maps route.
  - Google Street View direct look-around (`https://maps.google.com/maps?q=&layer=c&cbll={lat},{long}`).
- **Quick Tactical Actions:** Buttons with minimum 48px touch targets for `Cadastrar Vistoria` (Inspect), `Editar Hidrante` (Edit), and `Adicionar/Remover da Missão` (Add/Remove from Route).

### 4.3. Standardized Inspection Workflow (`InspectionModal`)
- **Ultra-Fast 2-Touch Inspection:** Pre-fills Timestamp, Current Coordinates, and Equipment ID.
- **33 Standardized Technical Failures Catalog:** Eliminates free-text inputs by enforcing multi-select tags from the official CBMDF fault catalog (e.g., "Registro emperrado", "Falta tampão de 2.1/2", "Registro soterrado").
- **Safety Confirmations:** Triggers a high-visibility modal confirmation when flagging a hydrant as `INOPERANTE`.
- **Dual State Update:** Appends an immutable record to the historical inspection log and immediately refreshes the active state (pin color, status badge, date).

### 4.4. Decoupled Mission Selection & Route Optimizer (TSP)
- **State Isolation (`selectedMissionIds`):** Global array of selected equipment that remains persistent across text searches, filter changes, and tab switches.
- **Haversine TSP Reoptimization:** Automatically calculates the shortest traveling sequence from the user's current GPS fix or the last inspected point.
- **Magic Link URL Hydration:** Encodes and restores mission lists via URL query parameters (`?ds=ID1,ID2,ID3...`).
- **WhatsApp Tactical Sharing:** Formats mission summaries with direct Waze links for instant crew sharing.

### 4.5. Global Glassmorphism Filter Bar (`FilterBar`)
- Real-time search by Address, Name, or Reference.
- Filter by Administrative Region (RA dropdown: Brasília, Guará, Taguatinga, etc.).
- Filter by Status (Operable / Inoperable / All).
- Specialized Filter by Specific Defect (filtering directly by any of the 33 official technical failures).
- Collapsible/Expandable interface with glassmorphism styling to maximize map viewport.

### 4.6. Data Table & Real-Time CSV/PDF Export
- Sortable tabular view of all hydrants with column-level sorting (Status, ID, RA, Address, Defect, Last Inspection).
- Batch selection checkboxes with "Select All Filtered" support.
- One-click live CSV export matching the exact filtered state.
- One-click Tactical PDF Report generation with KPI cards (Total, % Operable, Defect Breakdown).

---

## 5. Architecture Overview

### Key Technical Components:
- **Frontend Framework:** React 18 with TypeScript and Vite.
- **Styling & UI:** Tailwind CSS with high-contrast accessibility (tactical mobile ergonomics, min 48px touch targets, Neon Green `#00FF00`, Neon Red `#FF0000`, Cyan `#00FFFF`).
- **Mapping:** Leaflet & React-Leaflet with Google Hybrid Satellite Layer and conditional marker clustering.
- **Algorithms:** Haversine TSP route sequencing and geographic distance matrix calculator.
- **Export Engines:** PapaParse (CSV generation), jsPDF / jspdf-autotable (PDF mission sheets), XLSX.
- **Deployment:** Vercel automated CI/CD pipeline integrated with GitHub repository `andrerfcampos-max/netuno`.

---

## 6. Requirements & Acceptance Criteria

### 6.1 Functional Requirements
- **FR-01 (Data Ingestion & Sanitization):** The app must parse Excel/CSV databases, converting comma decimal coordinates to `parseFloat` and rejecting `NaN` entries to prevent map crashing.
- **FR-02 (Satellite Tile Rendering):** The map must load Google Hybrid satellite tiles with no tile loading failures or fallback to OpenStreetMap.
- **FR-03 (High-Contrast Markers):** Hydrants must render as pure CSS circles (Green = Operable, Red = Inoperable, Cyan ring = Selected in Mission).
- **FR-04 (Popup & Deep Linking):** Clicking any marker must open a popup containing complete details and functional external links (Waze, Google Maps, Street View).
- **FR-05 (Inspection Submission):** Submitting an inspection with a selected defect (from the 33 options) must update the marker color in real time and append to the inspection log.
- **FR-06 (Mission Persistence):** Selecting hydrants for a mission must preserve the selection even when global search filters are modified.
- **FR-07 (Route Optimization):** Activating route optimization must re-order selected hydrants by minimal physical distance using Haversine calculation.
- **FR-08 (Magic Link Sync):** Opening the URL with `?ds=101,102,103` must immediately hydrate the mission selection with those specific hydrants.
- **FR-09 (Export Capabilities):** The app must export valid CSV and PDF files containing filtered or mission data.

### 6.2 Non-Functional Requirements
- **NFR-01 (Performance & Responsiveness):** Initial interactive load time must be < 2.5 seconds; filter and search updates must execute in < 100ms.
- **NFR-02 (Mobile Usability & Touch Target):** All primary touch interactive elements must meet or exceed a 48px × 48px tap target size.
- **NFR-03 (High-Glare Legibility):** High contrast color ratios (black, pure white, neon green, neon red) must be preserved for sunlight readability.
- **NFR-04 (PWA Offline Operation):** The core application shell and cached datasets must operate seamlessly without internet connectivity.
