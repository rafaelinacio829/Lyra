import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import AgentsPage from "./pages/AgentsPage";
import ConversationsPage from "./pages/ConversationsPage";
import MarketingHome from "./pages/MarketingHome";
import OnboardingTenant from "./pages/OnboardingTenant";
import PricingPage from "./pages/PricingPage";
import TeamPage from "./pages/TeamPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import BillingPage from "./pages/BillingPage";
import MetricsPage from "./pages/MetricsPage";
import ContactsPage from "./pages/ContactsPage";
import PlatformPage from "./pages/PlatformPage";
import ErpPage from "./pages/ErpPage";
import WorkspaceHome from "./pages/WorkspaceHome";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={MarketingHome} />
      <Route path={"/pricing"} component={PricingPage} />
      <Route path={"/onboarding"} component={OnboardingTenant} />
      <Route path={"/app"}><DashboardLayout><WorkspaceHome /></DashboardLayout></Route>
      <Route path={"/app/agents"}><DashboardLayout><AgentsPage /></DashboardLayout></Route>
      <Route path={"/app/conversations"}><DashboardLayout><ConversationsPage /></DashboardLayout></Route>
      <Route path={"/app/contacts"}><DashboardLayout><ContactsPage /></DashboardLayout></Route>
      <Route path={"/app/platform"}><DashboardLayout><PlatformPage /></DashboardLayout></Route>
      <Route path={"/app/erp"}><DashboardLayout><ErpPage /></DashboardLayout></Route>
      <Route path={"/app/team"}><DashboardLayout><TeamPage /></DashboardLayout></Route>
      <Route path={"/app/metrics"}><DashboardLayout><MetricsPage /></DashboardLayout></Route>
      <Route path={"/app/billing"}><DashboardLayout><BillingPage /></DashboardLayout></Route>
      <Route path={"/app/integrations"}><DashboardLayout><IntegrationsPage /></DashboardLayout></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
