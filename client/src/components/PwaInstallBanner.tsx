import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("flow_one_pwa_dismissed") === "1");
  const [isIos, setIsIos] = useState(false);
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsIos(ios);
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);
  if (dismissed || (!promptEvent && !isIos)) return null;
  const close = () => { localStorage.setItem("flow_one_pwa_dismissed", "1"); setDismissed(true); };
  const install = async () => { if (!promptEvent) return; await promptEvent.prompt(); const choice = await promptEvent.userChoice; if (choice.outcome === "accepted") close(); setPromptEvent(null); };
  return <aside className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-[#cfe3d5] bg-[#f2f9ed] p-3 text-[#315145] shadow-sm"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dff1d4]"><Smartphone className="h-4 w-4 text-[#4f815f]" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">Instale o Flow One</p><p className="mt-0.5 text-xs leading-5 text-[#63796e]">{isIos ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início." : "Acesse sua operação como aplicativo, direto pela tela inicial."}</p></div>{promptEvent && <Button size="sm" onClick={install} className="rounded-full bg-[#315e49] text-white hover:bg-[#244b3a]"><Download className="mr-1 h-3.5 w-3.5" />Instalar</Button>}<Button size="icon" variant="ghost" onClick={close} className="h-8 w-8 shrink-0 rounded-full text-[#647d6f]"><X className="h-4 w-4" /></Button></aside>;
}
