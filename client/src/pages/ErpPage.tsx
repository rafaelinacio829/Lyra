import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ErpPage() {
  const tenants = trpc.tenant.mine.useQuery();
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [generatedFileId, setGeneratedFileId] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId && tenants.data?.[0]) setTenantId(tenants.data[0].id);
  }, [tenantId, tenants.data]);

  const documents = trpc.erp.lookup.useQuery(
    { tenantId: tenantId ?? 0, reference },
    { enabled: false, retry: false },
  );
  const fileUrl = trpc.files.downloadUrl.useQuery(
    { tenantId: tenantId ?? 0, fileId: generatedFileId ?? 0 },
    { enabled: Boolean(tenantId && generatedFileId), retry: false },
  );
  const createPdf = trpc.erp.createPdf.useMutation({
    onSuccess: result => {
      setGeneratedFileId(result.id);
      toast.success("PDF privado gerado. Use o link seguro para abrir o documento.");
    },
    onError: error => toast.error(error.message),
  });

  if (tenants.isLoading || !tenantId) {
    return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#5d8b75]" /></div>;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reference.trim().length < 3) return toast.error("Informe uma referência com ao menos 3 caracteres.");
    setGeneratedFileId(null);
    documents.refetch();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-2 sm:p-5">
      <section className="rounded-[1.7rem] border border-[#dfe9e2] bg-[#f3f8f4] p-7">
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[#5d8f78]">Integração opcional por tenant</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.035em] text-[#213c47]">Consultas no ERP</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687980]">Consulte registros e documentos na API de ERP configurada para sua empresa. Os PDFs gerados ficam no armazenamento privado do tenant.</p>
        <form onSubmit={submit} className="mt-6 flex max-w-xl gap-2">
          <Input value={reference} onChange={event => setReference(event.target.value)} placeholder="Cliente, pedido, contrato ou outra referência" />
          <Button type="submit" disabled={documents.isFetching} className="rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">
            {documents.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Consultar
          </Button>
        </form>
        {fileUrl.data?.url && <a className="mt-4 inline-flex items-center text-sm font-bold text-[#2f6c53] underline underline-offset-4" href={fileUrl.data.url} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Abrir último PDF gerado com acesso seguro</a>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#dfe8e2] bg-white">
        <div className="border-b border-[#edf1ee] px-6 py-5">
          <h2 className="font-display text-2xl text-[#304954]">Resultado da consulta</h2>
          <p className="mt-1 text-xs text-[#78878d]">A resposta depende da API, do token e do caminho de consulta configurados para o ERP deste tenant.</p>
        </div>
        {documents.error ? <p className="p-6 text-sm text-[#a45c4a]">{documents.error.message}</p> : documents.data?.length ? (
          <div className="divide-y divide-[#edf1ee]">
            {documents.data.map(document => <div key={document.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div><p className="font-bold text-[#405760]">{document.number}</p><p className="mt-1 text-xs text-[#7d8a90]">Vencimento: {document.dueDate || "Não informado"} · {document.status || "Sem status"}</p></div>
              <div className="flex items-center gap-3"><span className="text-sm font-bold text-[#477763]">{document.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span><Button size="sm" variant="outline" disabled={createPdf.isPending} onClick={() => createPdf.mutate({ tenantId, reference, documentId: document.id })} className="rounded-full"><FileText className="mr-2 h-4 w-4" />Gerar PDF</Button></div>
            </div>)}
          </div>
        ) : <p className="p-10 text-center text-sm text-[#7d8a90]">Informe uma referência para consultar os documentos disponíveis no ERP.</p>}
      </section>
    </div>
  );
}
