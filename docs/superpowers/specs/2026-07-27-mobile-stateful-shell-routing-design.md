# Stateful Shell Routing no Mobile — Design

## Objetivo

Substituir a seleção do drawer baseada em prefixos de URL no app Flutter por navegação explícita com `StatefulShellRoute.indexedStack`, e padronizar os paths autenticados em inglês.

## Escopo

- Converter a shell autenticada atual para `StatefulShellRoute.indexedStack`.
- Manter uma branch por seção principal do drawer.
- Exibir o drawer somente nas telas principais; detalhes e fluxos serão empilhados no navigator raiz.
- Remover `AppShellScreen._sectionFromRoute` e qualquer uso de `startsWith` para identificar a seção ativa.
- Centralizar metadados das seções em uma configuração tipada, usada tanto para criar branches quanto para renderizar o drawer.
- Renomear todos os paths autenticados e seus segmentos filhos para inglês.
- Manter splash, login, convite de registro e recuperação de senha fora da shell autenticada.
- Manter o editor de território fora da shell nesta mudança.

## Arquitetura

### Shell como outlet e fonte da seção ativa

`StatefulShellRoute.indexedStack` será o contêiner apenas das páginas principais autenticadas. Cada `StatefulShellBranch` terá um navigator próprio e conterá uma seção principal do drawer. O widget retornado pelo `builder` da shell receberá `StatefulNavigationShell` e o exibirá como `body` do `Scaffold`.

O drawer receberá o `StatefulNavigationShell` diretamente. O item ativo será definido por igualdade entre a branch configurada para o item e `navigationShell.currentIndex`; a ação de seleção chamará `navigationShell.goBranch(item.branchIndex, initialLocation: item.branchIndex == navigationShell.currentIndex)`. Assim, a shell preserva o estado de cada branch e não precisa deduzir a seção da URL.

Cada detalhe, edição e fluxo que deve permitir gesto de voltar será declarado fora da `StatefulShellRoute`, com `parentNavigatorKey: _rootNavigatorKey`. O `push` existente continuará a empilhar a rota, mas agora no navigator raiz; como o `Scaffold` com drawer não estará na árvore dessa página, o gesto esquerda→direita fará `pop` em vez de abrir o drawer.

### Configuração de seções

Um `enum AppSection` identifica semanticamente cada seção. Uma configuração privada associa cada seção a seu índice de branch, path inicial, rótulo, ícone e predicado de visibilidade. A ordem da configuração é a mesma das `StatefulShellBranch` e é a única relação com índices numéricos; o drawer não compara URLs.

Rotas que não aparecem no drawer (`dashboard`, `catalog` e `presentations`) e todas as rotas de detalhe/fluxo serão rotas autenticadas no navigator raiz. Elas não montam a shell e, portanto, não expõem o drawer.

### Paths autenticados

| Atual | Novo |
|---|---|
| `/workspace` | `/explore` |
| `/mapa` | `/map` |
| `/territorios` | `/territories` |
| `/pedidos` | `/orders` |
| `/cadastros` | `/registrations` |
| `/nao-conformidades` | `/non-conformities` |
| `/catalogo` | `/catalog` |
| `/produtos` | `/products` |
| `/apresentacoes` | `/presentations` |
| `/perfil` | `/profile` |
| `/usuarios` | `/users` |

Os seguintes segmentos filhos também passarão a inglês: `novo` para `new`, `carrinho` para `cart`, `sucesso` para `success`, `rastreio` para `tracking`, `brasindice` para `price-index`, `comparativo` para `comparison`, `convidar` para `invite`, `convites` para `invitations`, `editar` para `edit` e `atribuicoes` para `assignments`.

Não serão criados redirects ou aliases para os paths em português, pois esta mudança padroniza as URLs internas no novo vocabulário.

## Navegação fora da shell

`/territories/:id/edit` e `/territories/create` permanecerão no navigator raiz e não receberão drawer. A migração não adiciona autorização; quando RBAC for introduzido, as guards poderão ser aplicadas a essas rotas explicitamente, sem restaurar lógica de seleção por URL.

## Testes e validação

Adicionar testes de widget/unidade para a configuração da shell e do drawer que comprovem:

1. a branch atual determina o item ativo;
2. selecionar um item chama `goBranch` com a branch configurada;
3. uma rota de detalhe é empilhada no navigator raiz e não monta o drawer;
4. os paths em inglês são navegáveis e os paths em português não são usados pela configuração.

Executar `flutter test` e `flutter analyze` em `apps/mobile`.
