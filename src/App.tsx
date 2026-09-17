import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import SignIn from './auth/SignIn'
import AppShell from './components/AppShell'
import Spinner from './components/Spinner'
import { isConfigured } from './lib/supabase'
import Admin from './pages/Admin'
import Calendar from './pages/Calendar'
import Meals from './pages/Meals'
import Trip from './pages/Trip'
import NotConfigured from './pages/NotConfigured'
import Pending from './pages/Pending'
import Profile from './pages/Profile'

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
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Trip />} />
        <Route path="trip/:year" element={<Trip />} />
        <Route path="meals" element={<Meals />} />
        <Route path="meals/:year" element={<Meals />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="calendar/:year" element={<Calendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="members" element={<Admin />} />
        <Route path="*" element={<Trip />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Hash routing: GitHub Pages serves a 404 for any path it has no file
            for, which would break every deep link on a normal router. */}
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
