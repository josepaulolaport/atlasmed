# @vibe/auth

O pacote `@vibe/auth` é responsável pela gestão de permissões e habilidades dos usuários em uma aplicação, utilizando a biblioteca `@casl/ability` para definir regras de autorização e a biblioteca zod para validação de esquemas.

### Estrutura e Importações
O arquivo principal `src/index.ts` importa e exporta modelos, permissões e sujeitos relacionados à autorização. Ele também define funções para criar e configurar habilidades de acordo com o usuário.

### Definição de Habilidades
A função `defineAbilityFor` é usada para definir habilidades baseadas no papel do usuário. Ela utiliza um construtor de habilidades `AbilityBuilder` para configurar as permissões:


```37:55:packages/auth/src/index.ts
export function defineAbilityFor(user: User) {
const builder = new AbilityBuilder(createAppAbility)

if (typeof permissions[user.role] !== 'function') {
    throw new Error(`Permissions for role ${user.role} not found.`)
}

permissions[user.role](user, builder)

const ability = builder.build({
    detectSubjectType(subject) {
    return subject.__typename
    },
})

ability.can = ability.can.bind(ability)
ability.cannot = ability.cannot.bind(ability)

return ability
```


### Esquemas de Permissões
Os esquemas de permissões são definidos em `permissions.ts`, onde diferentes regras são aplicadas dependendo do papel do usuário (`ADMIN`, `MEMBER`, `BILLING`):


```12:29:packages/auth/src/permissions.ts
export const permissions: Record<Role, PermissionsByRole> = {
  ADMIN(user, { can, cannot }) {
    can('manage', 'all')

    cannot(['transfer_ownership', 'update'], 'Organization')
    can(['transfer_ownership', 'update'], 'Organization', {
      ownerId: { $eq: user.id },
    })
  },
  MEMBER(user, { can }) {
    can('get', 'User')
    can(['create', 'get'], 'Project')
    can(['update', 'delete'], 'Project', { ownerId: { $eq: user.id } })
  },
  BILLING(_, { can }) {
    can('manage', 'Billing')
  },
}
```


### Modelos e Sujeitos
Modelos como `User`, `Project` e `Organization` são definidos usando `zod` para garantir a validação de tipos. Cada modelo tem um sujeito correspondente que define as ações permitidas sobre esses modelos:

- `userSubject.ts`: Define ações sobre usuários.
- `projectSubject.ts`: Define ações sobre projetos.
- `organizationSubject.ts`: Define ações sobre organizações.

### Configurações
O pacote utiliza configurações de TypeScript, ESLint e Prettier especificadas nos arquivos `tsconfig.json`, `package.json` para manter a consistência do código e facilitar a manutenção.

### Conclusão
O pacote `@vibe/auth` é uma implementação detalhada e modular de controle de acesso, que permite uma gestão de permissões flexível e segura, baseada nos papéis dos usuários e nas regras de negócio específicas da aplicação.
