# CAB Booking Driver App - Feature-Driven Architecture

This folder implements a **Feature-Driven Architecture (FDA)** to ensure the React Native codebase remains highly modular, decoupled, and easy for multiple developers to scale concurrently.

---

## 1. Feature Folder Architecture

Every core capability of the Driver Application is isolated inside the `features/` directory. Each feature contains its own components, hooks, state management, and service calls, keeping the root-level `app/` routing layer extremely thin.

```
features/
├── auth/                       # Authentication (Login, register, token refresh)
│   ├── components/             # LoginForm, RegisterForm, SocialAuthButtons
│   ├── hooks/                  # useAuth, useSession
│   └── services/               # authApi.ts (login, register calls)
│
├── dashboard/                  # Core Driver HUD (Map, online/offline, proposal popups)
│   ├── components/             # DriverMap, ProposalCard, ActiveTripCard, OnlineToggle
│   ├── hooks/                  # useDriverAvailability, useLocationTracker
│   └── services/               # matchingApi.ts, driverAvailabilityApi.ts
│
├── jobs/                       # Driver Job History & Logs
│   ├── components/             # JobCard, HistoryList, JobDetailModal
│   ├── hooks/                  # useCompletedJobs
│   └── services/               # rideHistoryApi.ts
│
├── earnings/                   # Financials (Daily/weekly summaries, payouts)
│   ├── components/             # EarningsChart, WalletSummary, PayoutHistoryCard
│   ├── hooks/                  # useEarningsData
│   └── services/               # earningsApi.ts
│
└── account/                    # Driver Profile & Settings
    ├── components/             # ProfileForm, VehicleDetailsCard, SettingsToggle
    ├── hooks/                  # useDriverProfile
    └── services/               # profileApi.ts
```

---

## 2. Shared vs. Feature Code Rules

1. **Features are Independent**: A feature in `features/` should not directly import internal modules (like hooks or components) from *another* feature. If code needs to be shared between two features, promote it to the root `/components`, `/hooks`, or `/services` directory.
2. **Thin Routing Layer**: Files inside the `app/` folder should act solely as Entrypoints. They must import feature container components and mount them.
   * *Example*: `app/(driver-tabs)/earnings.tsx` should simply do:
     ```typescript
     import { EarningsScreenContainer } from '@/features/earnings';
     export default function Page() {
       return <EarningsScreenContainer />;
     }
     ```
3. **Strict Folder Anatomy**:
   * **`components/`**: Pure UI or presentational components specific only to this feature.
   * **`hooks/`**: Custom React hooks encapsulation logic, local state, or React Query integrations.
   * **`services/`**: Axios network clients and API mapping layers targeting backend endpoints.
