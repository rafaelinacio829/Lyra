# Pré-requisitos externos pendentes — Flow One

## Objetivo

Este documento registra os únicos passos que não devem ser ativados automaticamente no ambiente publicado. Eles exigem credenciais, domínio e contas sob controle do titular do produto. Até a conclusão, o Flow One mantém os recursos dependentes **desativados**, sem envio externo indevido.

| Frente | O que o titular precisa disponibilizar | O que será ativado no Flow One | Estado atual |
| --- | --- | --- | --- |
| E-mail transacional | Domínio remetente verificado, `RESEND_API_KEY` e endereço remetente | Recuperação de senha, alertas de SLA, trial e resumo operacional | Bloqueado por domínio/credencial |
| Meta Cloud API | Token permanente, App Secret, Verify Token, Phone Number ID e WABA por tenant | Webhook, mensagens oficiais e homologação real de canal | Bloqueado por credenciais do tenant |
| ERP personalizado | URL HTTPS pública, chave de acesso, rota de saúde e rota de consulta | Teste de conexão e consulta operacional real por tenant | Bloqueado por credenciais do tenant |
| Stripe | Sandbox reivindicado, produtos/preços revisados e chaves de homologação | Pagamento real de cartão/boleto e webhooks em produção | Bloqueado por revisão de conta e credenciais |
| Lojas mobile | Domínio próprio HTTPS, conta Google Play, Apple Developer e material de loja | Empacotamento TWA Android e Capacitor/Xcode iOS, TestFlight e revisão | Preparação PWA concluída; publicação bloqueada por contas/dominio |

## Procedimento seguro de ativação

As credenciais devem ser cadastradas exclusivamente pelos mecanismos seguros do projeto. Depois da configuração, a homologação deve ocorrer em tenant de teste e cobrir o recebimento de eventos, o isolamento do tenant, a auditoria e os caminhos de erro. Nenhum segredo deve ser enviado por e-mail, adicionado ao repositório ou incluído em capturas de tela.

> A publicação nas lojas exige que o domínio público e os textos de privacidade estejam associados à identidade jurídica que será titular do aplicativo. A base PWA do Flow One já é instalável e possui atualização controlada; os binários nativos só devem ser produzidos após esses pré-requisitos.

## Evidências internas já disponíveis

O projeto possui autenticação local, controles de senha e sessão, solicitação de exclusão de conta, trilha de auditoria, PWA instalável, health check de banco, painel de incidentes de integração, billing e webhooks testados por simulação. As etapas pendentes acima são exclusivamente de ativação externa e homologação com contas reais.
