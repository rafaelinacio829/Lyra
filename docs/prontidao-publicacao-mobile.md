# Prontidão para publicação mobile — Flow One

## Objetivo e escopo

Este documento organiza a preparação técnica e operacional do **Flow One** para distribuição futura na Google Play e App Store. Ele não autoriza a publicação nas lojas nem substitui revisão jurídica, fiscal ou das políticas vigentes de cada plataforma. As etapas que dependem de domínio, contas de desenvolvedor, credenciais ou decisões comerciais permanecem deliberadamente bloqueadas até que esses recursos sejam fornecidos.

| Área | Situação atual | Evidência no projeto | Próximo responsável |
|---|---|---|---|
| PWA instalável | Preparada | Manifesto com escopo, identidade, atalhos de Conversas e Canais; ícone maskable e metadados Apple | Produto/engenharia |
| Reabertura offline | Preparada para shell | Service worker cacheia o shell e ativos estáticos, sem cachear `/api/` | Engenharia |
| Login e privacidade | Preparada | Login próprio, recuperação por código, sessões, alteração de senha e solicitação autenticada de exclusão | Produto/operações |
| Notificações push | Não ativada | Nenhuma permissão ou provedor externo habilitado | Produto, após decisão e credenciais |
| Domínio definitivo | Bloqueado | O ambiente atual não deve ser usado como URL de loja | Titular do produto |
| Android TWA | Bloqueado | Ainda não existe projeto Bubblewrap nem chave de assinatura | Titular/engenharia |
| iOS nativo | Bloqueado | Ainda não existe projeto Capacitor/Xcode nem conta Apple Developer | Titular/engenharia |
| Conta de revisão | Bloqueada | Deve usar tenant de demonstração sem dados reais | Operações |

## Requisitos técnicos já configurados

O manifesto em `client/public/manifest.webmanifest` define o identificador `/app`, escopo global, modo independente, cor de tema, idioma, categoria de negócio e atalhos para a fila de conversas e a central de canais. O service worker mantém o shell instalável disponível para reabertura e cacheia apenas ativos estáticos da mesma origem; chamadas privadas de API ficam explicitamente fora do cache.

> A estratégia de cache não transforma dados de atendimento em dados offline. O aplicativo deve sinalizar indisponibilidade de rede e revalidar a sessão e os dados operacionais ao recuperar conexão.

## Checklist de bloqueios externos

| Pré-requisito | Android | iOS | Estado para o Flow One |
|---|---|---|---|
| Domínio próprio com HTTPS | Necessário para URL estável e Digital Asset Links | Necessário para APIs e links de suporte | Pendente |
| Conta de desenvolvedor | Google Play Console | Apple Developer Program e App Store Connect | Pendente |
| Identificador de pacote | Ex.: `com.flowone.app` | Deve corresponder ao Bundle ID | A definir pelo titular |
| Conta de revisão | Recomendado para testes internos e revisão | Necessário para acesso a fluxos protegidos | Pendente |
| Política de privacidade e suporte | URL pública exigida na ficha | URL pública exigida na ficha | Pendente de revisão jurídica e dados de contato |
| Estratégia de cobrança mobile | Revisar regras de pagamento antes de expor checkout | Revisar StoreKit e política antes de expor checkout | Stripe permanece somente no fluxo web |

## Roteiro de distribuição futura

No Android, a opção recomendada é uma **Trusted Web Activity** (TWA) gerada por Bubblewrap. A TWA abre o conteúdo web já hospedado e pressupõe que aplicativo e site estejam associados ao mesmo desenvolvedor por Digital Asset Links; o conteúdo também precisa ser útil no navegador por si só. [1]

No iOS, a opção prevista é um invólucro **Capacitor** com projeto Xcode, ícones e tela de abertura nativos. O Capacitor é distribuído à App Store como aplicativo nativo comum e deve seguir o processo de submissão da Apple. [2]

Antes de enviar uma versão à App Store, a conta de revisão deve conseguir entrar no Flow One e iniciar a exclusão da conta dentro do aplicativo. A Apple exige que apps com criação de conta permitam iniciar exclusão de conta no próprio app; etapas de reautenticação e confirmação são permitidas, desde que não criem fricção indevida. [3]

## Evidências a reunir no momento de homologação

1. URL definitiva do manifesto e do domínio, validada em Android e iPhone físicos.
2. Capturas reais de login, conversas, canais, conta e privacidade em tamanhos exigidos por cada loja.
3. Credenciais de conta de revisão com tenant demonstrativo, sem dados pessoais, tokens ou integrações reais.
4. Resultado de teste de reabertura offline, reconexão, logout, recuperação de senha e solicitação de exclusão.
5. Decisão formal sobre billing no binário; não publicar checkout Stripe no app sem revisar as políticas aplicáveis.
6. URLs revisadas de privacidade, termos e suporte, incluindo as retenções necessárias e um canal de contato da empresa.

## Referências

[1]: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities "Android Developers — Trusted Web Activities"

[2]: https://capacitorjs.com/docs/ios/deploying-to-app-store "Capacitor — Deploying to App Store"

[3]: https://developer.apple.com/support/offering-account-deletion-in-your-app/ "Apple Developer — Offering account deletion in your app"
