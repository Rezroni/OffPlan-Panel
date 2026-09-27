# Extractable components

## Header
- Source: `src/components/desk/Header.tsx`
- Category: layout
- Description: Sticky product identity, nine-route desktop dock, responsive mobile drawer, analyst identity, optional PDF action.
- Extractable props: `activeItem` (string, default derived from URL), `showPdfAction` (boolean, default false), `mobileMenuOpen` (boolean, default false)
- Hardcoded: OffPlan Desk name, DLD Verified status, route labels/icons, analyst identity and all visual styling.

## FundingExitSimulator
- Source: `src/components/funding/FundingExitSimulator.tsx`
- Category: basic
- Description: Reused full financial scenario workspace embedded in project detail and standalone funding route.
- Extractable props: `projectName`, `unitLabel`, `initialContractPriceAED`, `initialAreaSqft`, `initialHandoverDate`
- Hardcoded: fee rules, payment-plan presets, scenario tabs, explanatory copy and icon set.

## CompetingSupplyPanel
- Source: `src/components/pipeline/CompetingSupplyPanel.tsx`
- Category: basic
- Description: Reusable competing-delivery and cluster-collision risk panel on project detail.
- Extractable props: analysis data, risk level, delivery window
- Hardcoded: labels, iconography and risk explanation structure.
