import { useState } from "react";
import { AppView } from "./types/nexus";
import { NexusProvider } from "./store/useNexusStore";
import { TopNav } from "./components/TopNav";
import { Year2Hub } from "./components/Year2Hub";
import { Semester3Dashboard } from "./components/Semester3Dashboard";
import { PlacementSeason } from "./components/PlacementSeason";
import { JudgeDemoDrawer } from "./components/JudgeDemoDrawer";
import { PyqLabModal } from "./components/PyqLabModal";
import { HubBackground3D } from "./three/HubBackground3D";
import { Game01Pointer } from "./games/Game01Pointer";
import { Game02FetchCycle } from "./games/Game02FetchCycle";
import { Game03LaserPrism } from "./games/Game03LaserPrism";
import { Game04BridgeOfKings } from "./games/Game04BridgeOfKings";
import { Game05BreakEven } from "./games/Game05BreakEven";
import { Game06StackSurgeon } from "./games/Game06StackSurgeon";
import { CustomPyqLab } from "./games/CustomPyqLab";
import { AuthProvider } from "./store/useAuthStore";
import { FirebaseErrorBoundary } from "./components/FirebaseErrorBoundary";
import { AuthAccountModal } from "./components/AuthAccountModal";
import { RolePortalModal } from "./components/RolePortalModal";
import { tutorVoice } from "./services/tutorVoice";

function NexusAppShell() {
  const [view, setView] = useState<AppView>({ screen: "hub" });
  const [demoOpen, setDemoOpen] = useState(false);
  const [pyqModalOpen, setPyqModalOpen] = useState(false);

  const handleNavigate = (next: AppView) => {
    tutorVoice.cancel();
    setView(next);
  };

  const isDedicated3DGame = view.screen === "game" || view.screen === "custom-lab";
  const isProjectForge = view.screen === "placement-season" && view.tab === "project-forge";

  return (
    <div className="min-h-screen w-full bg-[#06080E] text-[#F4F7FB] flex flex-col relative overflow-x-hidden">
      {/* Keep a single active WebGL canvas: HubBackground3D runs on dashboard screens */}
      {!isDedicated3DGame && !isProjectForge && <HubBackground3D />}

      <TopNav
        view={view}
        onNavigate={handleNavigate}
        demoOpen={demoOpen}
        onToggleDemo={() => setDemoOpen((o) => !o)}
      />

      <JudgeDemoDrawer
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        view={view}
        onNavigate={handleNavigate}
        onOpenPyqGenerator={() => setPyqModalOpen(true)}
      />

      <PyqLabModal
        open={pyqModalOpen}
        onClose={() => setPyqModalOpen(false)}
        onLaunchLab={(config) => handleNavigate({ screen: "custom-lab", config })}
      />

      <AuthAccountModal />

      <RolePortalModal
        onLaunchLab={(config) => handleNavigate({ screen: "custom-lab", config })}
      />

      <div className="flex-1 relative z-10">
        {view.screen === "hub" && <Year2Hub onNavigate={handleNavigate} />}

        {view.screen === "exam-season" && (
          <Semester3Dashboard
            onNavigate={handleNavigate}
            onOpenPyqGenerator={() => setPyqModalOpen(true)}
          />
        )}

        {view.screen === "placement-season" && (
          <PlacementSeason activeTab={view.tab ?? "aptitude"} onNavigate={handleNavigate} />
        )}

        {view.screen === "game" && view.gameId === "pointer-3d" && (
          <Game01Pointer onExit={() => handleNavigate({ screen: "exam-season" })} />
        )}
        {view.screen === "game" && view.gameId === "fetch-cycle" && (
          <Game02FetchCycle onExit={() => handleNavigate({ screen: "exam-season" })} />
        )}
        {view.screen === "game" && view.gameId === "laser-prism" && (
          <Game03LaserPrism onExit={() => handleNavigate({ screen: "exam-season" })} />
        )}
        {view.screen === "game" && view.gameId === "bridge-kings" && (
          <Game04BridgeOfKings onExit={() => handleNavigate({ screen: "exam-season" })} />
        )}
        {view.screen === "game" && view.gameId === "break-even" && (
          <Game05BreakEven onExit={() => handleNavigate({ screen: "exam-season" })} />
        )}
        {view.screen === "game" && view.gameId === "stack-surgeon" && (
          <Game06StackSurgeon onExit={() => handleNavigate({ screen: "exam-season" })} />
        )}

        {view.screen === "custom-lab" && (
          <CustomPyqLab
            key={view.config.id}
            config={view.config}
            onExit={() => handleNavigate({ screen: "exam-season" })}
            onGenerateAnother={() => setPyqModalOpen(true)}
          />
        )}
      </div>

      {!isDedicated3DGame && (
        <footer className="relative z-10 border-t border-white/[0.06] bg-[#06080E]/90 px-4 py-3 text-center text-[11px] font-mono text-[#94A3B8]">
          © 2026 MAKAUT NEXUS 3D · Created by{" "}
          <span className="text-[#00F5D4] font-semibold">Rai Roy Chowdhury</span>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <FirebaseErrorBoundary>
      <AuthProvider>
        <NexusProvider>
          <NexusAppShell />
        </NexusProvider>
      </AuthProvider>
    </FirebaseErrorBoundary>
  );
}
