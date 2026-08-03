# Agenda e Interações Comerciais — Design

## Objetivo

Adicionar ao aplicativo móvel uma agenda cronológica para agentes comerciais e gestores, com interações presenciais ou remotas, bloqueios pessoais, recorrência simples, prevenção de conflitos e um fluxo de atendimento conectado a pedidos e notas de clínica.

## Escopo

- Implementação em `apps/mobile`, `apps/api`, `packages/database` e `packages/access`.
- `apps/web` não participa desta versão.
- O agente administra somente a própria agenda.
- O gestor consulta, sem alterar, agendas alcançadas pelo RBAC e escopo territorial existentes.
- Não serão geradas nem aplicadas migrations nesta branch. Somente os schemas Drizzle serão alterados; o responsável pelo merge gerará as migrations posteriormente.

## Vocabulário

- **Evento de agenda**: período que ocupa a agenda, sendo uma interação comercial ou bloqueio pessoal.
- **Interação**: atendimento comercial com uma clínica, presencial ou remoto.
- **Atendimento**: tela operacional usada para iniciar e concluir uma interação, criar pedidos e consultar/adicionar notas.
- **Ocorrência**: repetição individual de um evento avulso ou recorrente, com estado próprio.

`visit` deixa de ser o termo de negócio para novos fluxos porque sugere presença física. Os novos contratos e interfaces usam `calendar` e `interaction`.

## Modelo de domínio

### Calendar

`calendar` é responsável por disponibilidade, horário, recorrência e conflito. Um evento possui:

- proprietário (`ownerUserId`);
- tipo `INTERACTION` ou `PERSONAL_BLOCK`;
- título;
- horário local âncora, timezone IANA e duração;
- início/fim em UTC para o evento avulso ou primeira ocorrência;
- recorrência `NONE`, `DAILY`, `WEEKLY`, `MONTHLY` ou `YEARLY`;
- término opcional por data ou quantidade; ausência de ambos significa sem término;
- política fixa `CLAMP_TO_LAST_DAY` para datas inexistentes.

Bloqueios pessoais existem somente no calendário. Eventos de interação possuem uma interação correspondente.

### Interactions

`interactions` representa o estado comercial de cada ocorrência:

- evento e chave da ocorrência;
- clínica;
- agente comercial;
- modalidade `IN_PERSON` ou `REMOTE`;
- estado `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `NOT_COMPLETED` ou `CANCELLED`;
- início e término reais;
- cancelamento, correção e justificativas;
- vínculo opcional com o registro histórico em `visits` durante a migração de compatibilidade.

Cada repetição tem estado independente. Concluir ou cancelar uma ocorrência não modifica as demais.

### Occurrence overrides

Ocorrências de eventos recorrentes são expandidas por faixa durante a leitura. Persistimos um override quando uma ocorrência é reagendada, cancelada, iniciada, concluída ou marcada como não realizada. A identidade é `(calendarId, recurrenceKey)`, onde `recurrenceKey` representa a data/hora local original da repetição. Reagendar não muda essa identidade.

### Histórico

`interaction_events` é append-only e registra transições com origem `USER` ou `SYSTEM`, ator de usuário quando aplicável, estado anterior/novo, motivo, data e metadata segura. Eventos automáticos, como o processamento de vencidas, usam origem `SYSTEM` e podem não ter ator de usuário. Esse histórico é a fonte autoritativa do ciclo de vida.

### Pedidos e notas

- `orders.interactionId` é opcional.
- Uma interação pode ter zero ou vários pedidos.
- Todo pedido continua vinculado ao agente comercial por `sellerId`.
- Abrir “Novo pedido” pelo atendimento preenche clínica, agente e interação.
- A criação do pedido exige chave de idempotência e rejeita a reutilização da mesma chave pelo mesmo ator com payload diferente.
- Pedido e interação possuem ciclos de vida independentes.
- Notas continuam pertencendo à relação clínica–usuário e são opcionais.
- O agente pode criar e ler suas notas. Gestores autorizados podem ler notas dos agentes no escopo, mas não criá-las ou alterá-las em nome deles.

## Recorrência

O usuário escolhe data, horário e duração, e opcionalmente:

- diária, no mesmo horário local;
- semanal, no mesmo dia da semana e horário local;
- mensal, no mesmo dia do mês;
- anual, no mesmo mês e dia.

A recorrência pode terminar por data, quantidade ou não terminar.

A série preserva a data-base. Ao listar uma ocorrência mensal ou anual cujo dia não exista, a expansão usa o último dia do mês atual. Exemplos:

- mensal desde 31/01: 31/01, 28/02 ou 29/02, 31/03, 30/04;
- anual desde 29/02: 28/02 em ano não bissexto.

O cálculo ocorre no timezone IANA armazenado na série e cada ocorrência é convertida para UTC. A visualização converte o instante para o timezone local atual do dispositivo.

## Disponibilidade e conflitos

- Interações e bloqueios pessoais competem pela mesma agenda.
- Intervalos são semiabertos: `[início, fim)`. Um evento pode começar quando outro termina.
- Qualquer sobreposição rejeita a criação ou alteração inteira.
- Eventos e ocorrências cancelados não bloqueiam horários.
- A API compara o novo evento ou série com os eventos existentes do proprietário.
- As frequências permitidas são limitadas às quatro regras simples acima; o serviço de recorrência centraliza expansão e interseção.
- O mobile pode fazer uma pré-validação, mas o backend é a autoridade.
- Comandos de calendário, início/conclusão de interação e criação de pedido usam chave de idempotência; alterações de calendário, cancelamentos e transições de interação também usam versão otimista para tolerar retry do mobile.

Como migrations não serão produzidas nesta branch, uma constraint de exclusão PostgreSQL para impedir corridas de sobreposição será documentada como migration obrigatória antes do merge. Até ela existir no banco, o repositório usa transação e lock por proprietário.

## Ciclo da interação

```text
SCHEDULED -> IN_PROGRESS -> COMPLETED
    |
    +-> NOT_COMPLETED -> COMPLETED
```

O schema também define `CANCELLED`. No fluxo entregue, o cancelamento ocorre pelos endpoints de calendário e cancela a interação materializada correspondente, sem uma rota própria de transição em `interactions`.

Regras:

- abrir o atendimento não muda o estado;
- somente “Iniciar atendimento” muda para `IN_PROGRESS`;
- o agente pode iniciar antes do horário programado;
- ao terminar o horário em `SCHEDULED`, a interação torna-se `NOT_COMPLETED`;
- `IN_PROGRESS` não muda automaticamente para não realizada ao ultrapassar o horário;
- concluir cria exatamente um registro histórico em `visits` durante a compatibilidade e liga `interactions.visitId`;
- corrigir `NOT_COMPLETED` para `COMPLETED` exige justificativa e auditoria;
- cancelar exige motivo e só é permitido em `SCHEDULED`;
- reagendar só é permitido em `SCHEDULED` e preserva o horário anterior no histórico.

Um job periódico persiste `NOT_COMPLETED`. A leitura também deriva essa condição quando o horário já terminou, para não exibir uma ocorrência vencida como agendada antes da execução do job.

## API

### Calendar

- `GET /calendar?from=&to=&ownerUserId=`: lista agenda expandida e cronológica.
- `GET /calendar/availability?from=&to=&ownerUserId=`: retorna intervalos ocupados/disponíveis para o formulário.
- `POST /calendar`: cria interação ou bloqueio, avulso ou recorrente.
- `PATCH /calendar/:id`: altera série ou evento avulso enquanto permitido.
- `PATCH /calendar/:id/occurrences/:recurrenceKey`: reagenda somente uma ocorrência.
- `DELETE /calendar/:id`: cancela evento/série com motivo.
- `DELETE /calendar/:id/occurrences/:recurrenceKey`: cancela somente uma ocorrência com motivo.

### Interactions

- `GET /interactions/:id`: contexto completo do atendimento.
- `POST /interactions/:id/start`: inicia atendimento.
- `POST /interactions/:id/complete`: conclui atendimento; justificativa obrigatória quando corrige `NOT_COMPLETED`.
- `GET /orders?interactionId=`: lista pedidos vinculados.
- `POST /orders` com `interactionId`: cria pedido com clínica/agente/interação validados pelo backend e exige `Idempotency-Key`.

Os handlers seguem Elysia + TypeBox + Zod, `auth`, `requirePermission`, `getScope()`, use-case e DTO explícito. Não expõem tipos Drizzle.

## Autorização

Novos subjects:

- `CALENDAR`: `ADMIN manage`, `REP create/read/update/delete` próprios, `MANAGER read` no escopo gerenciado.
- `INTERACTION`: mesmas capacidades, com alteração reservada ao agente proprietário; gestor somente lê.

Toda mutação ignora `ownerUserId` fornecido pelo cliente e usa o usuário autenticado. A leitura gerencial exige:

1. proprietário em `scope.managedUserIds` ou acesso global;
2. para interações, clínica dentro de `scope.facilityIds` e vertical ativa quando aplicável.

Bloqueios não dependem de clínica. Na visão gerencial, bloqueios exibem horário e o rótulo “Indisponível”; o título pessoal não é exposto.

A leitura gerencial de notas recebe um endpoint explícito com `noteOwnerUserId`; o use-case verifica usuário gerenciado e clínica no escopo. A API atual do próprio usuário permanece compatível.

## Mobile

Nova feature `apps/mobile/lib/features/agenda/` com modelos, repositório HTTP, providers Riverpod e telas.

### Agenda

- nova branch `/agenda` na shell e item “Agenda” no drawer;
- lista cronológica agrupada por dia, inspirada na referência anexada sem copiar o estilo do iOS;
- horários alinhados à direita, modalidade e clínica como contexto, e estado por texto/ícone além de cor;
- controles de período, busca e criação;
- gestor pode selecionar um agente permitido e filtrar por estado/modalidade, mantendo todos os controles de mutação ocultos;
- estados de loading, vazio, erro e retry seguem o padrão do app.

### Formulário

- escolha entre Interação e Bloqueio pessoal;
- clínica obrigatória para interação;
- modalidade Presencial ou Remoto;
- data, horário, duração padrão de uma hora e ajustes em intervalos de 30 minutos;
- qualquer horário é permitido quando livre;
- recorrência opcional e término;
- conflito bloqueia o envio e apresenta as primeiras ocorrências conflitantes.

O botão “Visita” na tela de clínica passa a “Agendar interação” e abre o formulário com a clínica preenchida. Não registra conclusão imediata.

### Atendimento

Rota raiz `/agenda/interactions/:id` fora da shell, contendo:

- clínica, modalidade, horário e estado;
- “Iniciar atendimento”;
- “Novo pedido” com contexto preenchido;
- lista de pedidos vinculados;
- notas clínica–agente existentes e criação opcional de nota;
- “Concluir atendimento”;
- reagendar e cancelar enquanto `SCHEDULED`.

Abrir o fluxo de pedidos preserva `interactionId` e retorna ao atendimento após sucesso. O carrinho mantém esse contexto até limpar ou finalizar.

## Compatibilidade com visits

- Novas ações usam `calendar` e `interactions`.
- `visits` permanece temporariamente como ledger de interações concluídas para não quebrar resumo semanal e consumidores atuais.
- A conclusão de uma interação cria um `visit` idempotentemente.
- Métricas serão migradas para `interactions COMPLETED` em uma etapa compatível.
- Registros antigos de `visits` serão migrados posteriormente para interações históricas com `calendarId` nulo, sem inventar duração ou agendamento.
- A remoção de `visits` fica fora desta entrega e só ocorre após migração de dados e consumidores.

## Offline e concorrência

- Formulários preservam dados locais quando a rede falha.
- Comandos usam idempotency key gerada no mobile.
- A UI não assume sucesso antes da confirmação do backend.
- Erro de versão ou conflito oferece recarregar o evento e reaplicar a ação.
- Notas e pedidos mantêm seus fluxos atuais; falhas não concluem automaticamente a interação.

## Testes

### Banco e domínio

- expansão diária, semanal, mensal e anual;
- 29/30/31, fevereiro e ano bissexto;
- timezone e mudança de offset;
- interseção, limites adjacentes e eventos cancelados;
- máquina de estados e idempotência;
- conclusão cria apenas um `visit`;
- pedido mantém agente, clínica e interação.

### API

Cobrir happy path, sem autenticação, sem permissão, fora do escopo, owner incorreto, gestor read-only, validação, conflito, recorrência, cancelamento, não realizada, correção auditada e retries.

### Mobile

Cobrir agrupamento cronológico, formulário, conflito, recorrência, permissões do gestor, navegação da clínica, atendimento, contexto de pedido, notas e estados de rede.

## Critérios de conclusão

- agente agenda interação ou bloqueio sem sobreposição;
- recorrência é listada com a regra de último dia;
- cada ocorrência possui ciclo independente;
- agente inicia, cria pedidos/notas e conclui uma interação;
- vencidas não iniciadas aparecem e são persistidas como não realizadas;
- correção exige justificativa e fica auditada;
- gestor consulta agendas e notas permitidas sem conseguir alterar;
- contratos antigos de `visits` continuam funcionando;
- nenhum arquivo de migration é criado ou alterado nesta branch.
