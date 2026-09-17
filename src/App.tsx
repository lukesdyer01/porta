import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import SignIn from './auth/SignIn'
import AppShell from './components/AppShell'
import ErrorBoundary from './components/ErrorBoundary'
import Spinner from './components/Spinner'
import { isConfigured } from './lib/supabase'
import Admin from './pages/Admin'
import Calendar from './pages/Calendar'
import Expenses from './pages/Expenses'
import Gallery from './pages/Gallery'
import Journal from './pages/Journal'
import Meals from './pages/Meals'
import Trip from './pages/Trip'
import Trips from './pages/Trips'
import NotConfigured from './pages/NotConfigured'
import Pending from './pages/Pending'
import Profile from './pages/Profile'
import { TripProvider } from './trip/TripProvider'

// Leaflet is a large dependency that most visits never touch, and this app is
// opened on phone data at the beach. Load it only when the map is opened.
const TripMap = lazy(() => import('./pages/Map'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

function Gate() {
  const { session, loading, pending } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <SignIn />
  if (pending) return <Pending />

  return (
    <TripProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Trips />} />
          {/* Both forms: the nav links carry a year, but a bare path still works. */}
          <Route path="trip" element={<Trip />} />
          <Route path="trip/:year" element={<Trip />} />
          <Route path="meals" element={<Meals />} />
          <Route path="meals/:year" element={<Meals />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="calendar/:year" element={<Calendar />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/:year" element={<Expenses />} />
          <Route path="photos" element={<Gallery />} />
          <Route path="photos/:year" element={<Gallery />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:year" element={<Journal />} />
          <Route
            path="map"
            element={
              <Suspense
                fallback={<p className="text-sm text-[color:var(--text-muted)]">Loading map…</p>}
              >
                <TripMap />
              </Suspense>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route path="members" element={<Admin />} />
          <Route path="*" element={<Trips />} />
        </Route>
      </Routes>
    </TripProvider>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Hash routing: GitHub Pages serves a 404 for any path it has no file
            for, which would break every deep link on a normal router. */}
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
