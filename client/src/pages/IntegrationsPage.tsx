import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CloudUpload, FileLock2, KeyRound, Loader2, Plus, QrCode, Save, ServerCog, ShieldCheck, Smartphone } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

function createDefaultZapi() {
  return {
    id: crypto.randomUUID(),
    name: "WhatsApp principal",
    instanceId: "",
    instanceToken: "",
    clientToken: "",
    webhookUrl: "",
  };
}

function createDefaultMeta() {
  return {
    id: crypto.randomUUID(),
    name: "WhatsApp oficial",
    phoneNumberId: "",
    accessToken: "",
    appSecret: "",
    graphApiVersion: "v23.0",
    webhook: null as { webhookUrl: string; verifyToken: string } | null,
  };
}

function createDefaultErp() {
  return {
    id: crypto.randomUUID(),
    name: "ERP da empresa",
    baseUrl: "",
    healthPath: "/health",
    lookupPath: "/api/documents?reference={reference}",
    apiKey: "",
  };
}

export default function IntegrationsPage() {
  const tenants = trpc.tenant.mine.useQuery();
  const [tenantId, setTenantId] = useState<number | null>(null);
  useEffect(() => { if (!tenantId && tenants.data?.[0]) setTenantId(tenants.data[0].id); }, [tenantId, tenants.data]);
  const integrations = trpc.integrations.list.useQuery({ tenantId: tenantId ?? 0 }, { enabled: Boolean(tenantId) });
  const files = trpc.files.list.useQuery({ tenantId: tenantId ?? 0 }, { enabled: Boolean(tenantId) });

  if (tenants.isLoading || !tenantId) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#5d8b75]" /></div>;

  return <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-5">
    <section className="rounded-[1.7rem] border border-[#dce7df] bg-[#f4f8f5] p-6"><p className="text-xs font-bold uppercase tracking-[.17em] text-[#5d8f78]">Conexões da empresa</p><h1 className="mt-2 font-display text-4xl tracking-[-.035em] text-[#213c47]">Integrações por instância</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c7b82]">Crie quantas instâncias forem necessárias para cada canal ou sistema. Cada ambiente fica isolado pelo tenant e pode ter seu próprio nome, credenciais e webhook.</p><div className="mt-4 max-w-3xl rounded-2xl border border-[#cfe1d4] bg-white/70 p-4 text-sm text-[#517064]"><strong>Vários números de WhatsApp:</strong> salve cada conexão com um nome diferente, como “Vendas”, “Suporte” ou “Filial Recife”. Cada webhook e cada conversa permanecem vinculados ao número de origem.</div></section>
    <div className="grid gap-5 lg:grid-cols-2"><ZapiForm tenantId={tenantId} onDone={() => integrations.refetch()} /><MetaForm tenantId={tenantId} onDone={() => integrations.refetch()} /><CustomErpForm tenantId={tenantId} onDone={() => integrations.refetch()} /></div>
    <section className="rounded-3xl border border-[#dce7df] bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e8f4e6]"><ServerCog className="h-5 w-5 text-[#5c8a70]" /></div><div><h2 className="font-display text-2xl text-[#2e4853]">Instâncias configuradas</h2><p className="mt-1 text-xs text-[#77878d]">Status e metadados não sensíveis das integrações desta empresa.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{integrations.data?.length ? integrations.data.map(integration => <IntegrationCard key={integration.id} integration={integration} tenantId={tenantId} onChanged={() => integrations.refetch()} />) : <p className="text-sm text-[#7a898f]">Nenhuma instância configurada ainda.</p>}</div></section>
    <PrivateFiles tenantId={tenantId} files={files.data ?? []} onChanged={() => files.refetch()} />
  </div>;
}

function ZapiForm({ tenantId, onDone }: { tenantId: number; onDone: () => void }) {
  const save = trpc.integrations.saveZapi.useMutation({
    onSuccess: result => {
      setInstances(current => current.map(item => (item.id === activeFormId ? { ...item, webhookUrl: result.webhookUrl } : item)));
      toast.success("Instância Z-API salva. Revise a URL do webhook antes de ativar.");
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const [instances, setInstances] = useState(() => [createDefaultZapi()]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  const addInstance = () => {
    const next = createDefaultZapi();
    const index = instances.length + 1;
    next.name = `WhatsApp ${index}`;
    setInstances(current => [...current, next]);
    setActiveFormId(next.id);
  };

  const updateInstance = (id: string, field: keyof ReturnType<typeof createDefaultZapi>, value: string) => {
    setInstances(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const submit = (event: FormEvent, instance: ReturnType<typeof createDefaultZapi>) => {
    event.preventDefault();
    setActiveFormId(instance.id);
    save.mutate({ tenantId, name: instance.name, instanceId: instance.instanceId, instanceToken: instance.instanceToken, clientToken: instance.clientToken });
  };

  return <div className="rounded-3xl border border-[#dce7df] bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eaf3e8]"><Smartphone className="h-5 w-5 text-[#5f8b71]" /></div><div><h2 className="font-display text-2xl text-[#2e4853]">WhatsApp via Z-API</h2><p className="text-xs text-[#76868c]">Múltiplas instâncias por tenant.</p></div></div><Button type="button" variant="outline" onClick={addInstance} className="rounded-full border-[#d7e3dc] bg-white text-[#203b47]"><Plus className="mr-2 h-4 w-4" />Nova instância</Button></div>{instances.map((instance, index) => <form key={instance.id} onSubmit={event => submit(event, instance)} className="mt-5 rounded-2xl border border-[#e5eeea] bg-[#fbfcfb] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8475]">Instância {index + 1}</p><span className="text-[11px] text-[#76868c]">{instance.name || "Nova instância"}</span></div><div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Input value={instance.name} onChange={event => updateInstance(instance.id, "name", event.target.value)} placeholder="Nome da instância" required /><Input value={instance.instanceId} onChange={event => updateInstance(instance.id, "instanceId", event.target.value)} placeholder="ID da instância" required /></div><Input type="password" value={instance.instanceToken} onChange={event => updateInstance(instance.id, "instanceToken", event.target.value)} placeholder="Token da instância" required /><Input type="password" value={instance.clientToken} onChange={event => updateInstance(instance.id, "clientToken", event.target.value)} placeholder="Client-Token" required /></div><Button type="submit" disabled={save.isPending} className="mt-5 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">{save.isPending && activeFormId === instance.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar instância</Button>{instance.webhookUrl && <div className="mt-4 rounded-2xl bg-[#f5f8f6] p-4"><p className="text-xs font-bold text-[#4c6069]">URL do webhook</p><p className="mt-2 break-all text-xs text-[#718087]">{instance.webhookUrl}</p></div>}</form>)}</div>;
}

function MetaForm({ tenantId, onDone }: { tenantId: number; onDone: () => void }) {
  const save = trpc.integrations.saveMeta.useMutation({
    onSuccess: result => {
      setInstances(current => current.map(item => (item.id === activeFormId ? { ...item, webhook: result } : item)));
      toast.success("Instância de WhatsApp salva. Cadastre a URL e o token na Meta antes de testar.");
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const [instances, setInstances] = useState(() => [createDefaultMeta()]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  const addInstance = () => {
    const next = createDefaultMeta();
    const index = instances.length + 1;
    next.name = `WhatsApp Cloud ${index}`;
    setInstances(current => [...current, next]);
    setActiveFormId(next.id);
  };

  const updateInstance = (id: string, field: keyof ReturnType<typeof createDefaultMeta>, value: string) => {
    setInstances(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const submit = (event: FormEvent, instance: ReturnType<typeof createDefaultMeta>) => {
    event.preventDefault();
    setActiveFormId(instance.id);
    save.mutate({ tenantId, name: instance.name, phoneNumberId: instance.phoneNumberId, accessToken: instance.accessToken, appSecret: instance.appSecret, graphApiVersion: instance.graphApiVersion });
  };

  return <div className="rounded-3xl border border-[#dce7df] bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e8eff7]"><Smartphone className="h-5 w-5 text-[#517590]" /></div><div><h2 className="font-display text-2xl text-[#2e4853]">WhatsApp oficial da Meta</h2><p className="text-xs text-[#76868c]">Uma ou mais contas Cloud API por tenant.</p></div></div><Button type="button" variant="outline" onClick={addInstance} className="rounded-full border-[#d7e3dc] bg-white text-[#203b47]"><Plus className="mr-2 h-4 w-4" />Nova instância</Button></div>{instances.map((instance, index) => <form key={instance.id} onSubmit={event => submit(event, instance)} className="mt-5 rounded-2xl border border-[#e5eeea] bg-[#fbfcfb] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8475]">Instância {index + 1}</p><span className="text-[11px] text-[#76868c]">{instance.name || "Nova instância"}</span></div><div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Input value={instance.name} onChange={event => updateInstance(instance.id, "name", event.target.value)} placeholder="Nome da instância" required /><Input value={instance.phoneNumberId} onChange={event => updateInstance(instance.id, "phoneNumberId", event.target.value)} placeholder="Phone Number ID" required /></div><Input type="password" value={instance.accessToken} onChange={event => updateInstance(instance.id, "accessToken", event.target.value)} placeholder="Token de sistema da Meta" required /><div className="grid gap-3 sm:grid-cols-2"><Input type="password" value={instance.appSecret} onChange={event => updateInstance(instance.id, "appSecret", event.target.value)} placeholder="App Secret" required /><Input value={instance.graphApiVersion} onChange={event => updateInstance(instance.id, "graphApiVersion", event.target.value)} placeholder="v23.0" required /></div></div><Button type="submit" disabled={save.isPending} className="mt-5 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">{save.isPending && activeFormId === instance.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar instância</Button>{instance.webhook && <div className="mt-4 rounded-2xl bg-[#f5f8f6] p-4"><p className="text-xs font-bold text-[#4c6069]">Cadastre estes dados na Meta</p><p className="mt-2 break-all text-xs text-[#718087]">URL: {instance.webhook.webhookUrl}</p><p className="mt-1 break-all text-xs text-[#718087]">Token: {instance.webhook.verifyToken}</p></div>}</form>)}</div>;
}

function CustomErpForm({ tenantId, onDone }: { tenantId: number; onDone: () => void }) {
  const save = trpc.integrations.saveCustomErp.useMutation({ onSuccess: () => { toast.success("Instância de ERP salva e pronta para teste."); onDone(); }, onError: error => toast.error(error.message) });
  const [instances, setInstances] = useState(() => [createDefaultErp()]);

  const addInstance = () => {
    const next = createDefaultErp();
    const index = instances.length + 1;
    next.name = `ERP ${index}`;
    setInstances(current => [...current, next]);
  };

  const updateInstance = (id: string, field: keyof ReturnType<typeof createDefaultErp>, value: string) => {
    setInstances(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const submit = (event: FormEvent, instance: ReturnType<typeof createDefaultErp>) => {
    event.preventDefault();
    save.mutate({ tenantId, name: instance.name, baseUrl: instance.baseUrl, healthPath: instance.healthPath, lookupPath: instance.lookupPath, apiKey: instance.apiKey });
  };

  return <div className="rounded-3xl border border-[#dce7df] bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f3ecdf]"><ServerCog className="h-5 w-5 text-[#9c783f]" /></div><div><h2 className="font-display text-2xl text-[#2e4853]">ERP personalizado</h2><p className="text-xs text-[#76868c]">Várias integrações de ERP por tenant.</p></div></div><Button type="button" variant="outline" onClick={addInstance} className="rounded-full border-[#d7e3dc] bg-white text-[#203b47]"><Plus className="mr-2 h-4 w-4" />Nova instância</Button></div>{instances.map((instance, index) => <form key={instance.id} onSubmit={event => submit(event, instance)} className="mt-5 rounded-2xl border border-[#e5eeea] bg-[#fbfcfb] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#5d8475]">Instância {index + 1}</p><span className="text-[11px] text-[#76868c]">{instance.name || "Nova instância"}</span></div><div className="grid gap-3"><Input value={instance.name} onChange={event => updateInstance(instance.id, "name", event.target.value)} placeholder="Nome da instância" required /><Input type="url" value={instance.baseUrl} onChange={event => updateInstance(instance.id, "baseUrl", event.target.value)} placeholder="https://erp.suaempresa.com" required /><div className="grid gap-3 sm:grid-cols-2"><Input value={instance.healthPath} onChange={event => updateInstance(instance.id, "healthPath", event.target.value)} placeholder="/health" required /><Input value={instance.lookupPath} onChange={event => updateInstance(instance.id, "lookupPath", event.target.value)} placeholder="/api/documentos?referencia={reference}" required /></div><Input type="password" value={instance.apiKey} onChange={event => updateInstance(instance.id, "apiKey", event.target.value)} placeholder="Token de API do ERP" required /></div><Button type="submit" disabled={save.isPending} className="mt-5 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Salvar instância</Button></form>)}</div>;
}

function IntegrationCard({ integration, tenantId, onChanged }: { integration: any; tenantId: number; onChanged: () => void }) {
  const activate = trpc.integrations.activateZapiWebhook.useMutation({ onSuccess: () => { toast.success("Webhook Z-API ativado."); onChanged(); }, onError: error => toast.error(error.message) });
  const testMeta = trpc.integrations.testMeta.useMutation({ onSuccess: () => { toast.success("WhatsApp Cloud API validada."); onChanged(); }, onError: error => toast.error(error.message) });
  const testCustomErp = trpc.integrations.testCustomErp.useMutation({ onSuccess: () => { toast.success("ERP personalizado validado."); onChanged(); }, onError: error => toast.error(error.message) });
  const label = integration.provider === "zapi" ? "Z-API" : integration.provider === "erp_custom" ? "ERP personalizado" : integration.provider === "meta" ? "WhatsApp Cloud API" : "Dify";
  return <article className="rounded-2xl border border-[#e1e9e4] bg-[#fbfcfb] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#435963]">{label} · {integration.name}</p><p className="mt-1 text-xs text-[#77878d]">{integration.secretConfigured ? "Credencial configurada" : "Sem credencial"}</p></div><Badge className={integration.status === "active" ? "bg-[#e8f5e5] text-[#4c805a] hover:bg-[#e8f5e5]" : integration.status === "error" ? "bg-[#fff0eb] text-[#a66049] hover:bg-[#fff0eb]" : "bg-[#edf1f2] text-[#687982] hover:bg-[#edf1f2]"}>{integration.status}</Badge></div>{integration.provider === "zapi" && integration.status !== "active" && <Button onClick={() => activate.mutate({ tenantId, integrationId: integration.id })} disabled={activate.isPending} size="sm" className="mt-4 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]"><QrCode className="mr-1.5 h-3.5 w-3.5" />Ativar webhook</Button>}{integration.provider === "meta" && integration.status !== "active" && <Button onClick={() => testMeta.mutate({ tenantId, integrationId: integration.id })} disabled={testMeta.isPending} size="sm" className="mt-4 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">{testMeta.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Testar conexão</Button>}{integration.provider === "erp_custom" && integration.status !== "active" && <Button onClick={() => testCustomErp.mutate({ tenantId, integrationId: integration.id })} disabled={testCustomErp.isPending} size="sm" className="mt-4 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">{testCustomErp.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Testar conexão</Button>}{integration.lastError && <p className="mt-3 text-xs text-[#a75e46]">{integration.lastError}</p>}</article>;
}

function PrivateFiles({ tenantId, files, onChanged }: { tenantId: number; files: any[]; onChanged: () => void }) {
  const upload = trpc.files.upload.useMutation({ onSuccess: () => { toast.success("Arquivo enviado para armazenamento privado."); onChanged(); }, onError: error => toast.error(error.message) });
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const result = typeof reader.result === "string" ? reader.result.split(",")[1] : ""; if (result) upload.mutate({ tenantId, originalName: file.name, mimeType: file.type || "application/octet-stream", classification: "financial_document", base64: result }); }; reader.readAsDataURL(file); };
  const classificationLabel = (value: string) => value === "financial_document" ? "Documento privado" : value === "conversation_export" ? "Exportação de conversa" : value === "media" ? "Mídia" : "Documento";
  return <section className="rounded-3xl border border-[#dce7df] bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eaf3e8]"><FileLock2 className="h-5 w-5 text-[#5f8b71]" /></div><div><h2 className="font-display text-2xl text-[#2e4853]">Arquivos privados</h2><p className="mt-1 text-xs text-[#77878d]">PDFs, imagens, mídias e documentos operacionais ficam fora do diretório público.</p></div></div><Label className="inline-flex h-10 items-center rounded-full bg-[#203b47] px-4 text-sm font-semibold text-white hover:bg-[#2d4f5b]"><CloudUpload className="mr-2 h-4 w-4" />Enviar arquivo<input type="file" className="hidden" onChange={handleFile} /></Label></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{files.length ? files.map(file => <div key={file.id} className="rounded-2xl bg-[#f7faf8] px-4 py-3"><p className="truncate text-sm font-bold text-[#49606a]">{file.originalName}</p><p className="mt-1 text-xs text-[#7c8b91]">{Math.round(file.sizeBytes / 1024)} KB · {classificationLabel(file.classification)}</p></div>) : <p className="text-sm text-[#7a898f]">Nenhum arquivo privado enviado.</p>}</div><div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#f3f8f4] p-3 text-xs text-[#5f746f]"><ShieldCheck className="h-4 w-4 text-[#5d8e70]" />O download é liberado somente após verificação de acesso ao tenant por URL assinada.</div></section>;
}
